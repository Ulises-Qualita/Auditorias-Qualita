# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

`AGENTS.md` (importado arriba) es la fuente de verdad del **producto**: alcance, esquema de Supabase, reglas duras de seguridad, especificaciones de diseño y forma de trabajo. Este archivo cubre lo que falta ahí: **comandos y arquitectura de código**.

## Comandos

```bash
npm run dev     # Next dev server en :3000
npm run inngest # Inngest Dev Server en :8288 (background del análisis)
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # eslint (flat config; sin argumentos, lint del repo entero)
```

**El análisis en background necesita las DOS terminales.** `npm run dev` levanta Next y
`npm run inngest` levanta el Dev Server de Inngest, que descubre las funciones solo
(hace GET a `http://localhost:3000/api/inngest`), recibe los eventos y los ejecuta. Sin
él, `POST /api/diagnostics` responde 201 pero el diagnóstico se queda en `pending`
porque nadie toma el evento. En local no hace falta ninguna key; el dashboard con los
eventos, las corridas y los reintentos está en http://localhost:8288.

No hay framework de tests configurado todavía. Si se agrega uno, documentar acá cómo correr un test suelto.

Probar el route handler a mano:

```bash
curl -X POST http://localhost:3000/api/diagnostics \
  -H 'content-type: application/json' \
  -d '{"name":"Acme","contact_name":"Uli","contact_email":"a@b.com"}'
```

## Estado real del repo (leer antes de tocar nada)

- `package.json` ya está al día: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `@anthropic-ai/sdk`, `cheerio` e `inngest` están en `dependencies` e instalados. `npm run build` pasa limpio.
- La identidad de Qualita **ya está aplicada**: `app/layout.tsx` carga Unbounded + DM Sans y `app/globals.css` tiene los tokens de la marca (con el puente `@theme` que habilita `bg-navy`, `text-tinta`, `border-linea`, etc.). El scaffold de create-next-app se fue: `app/page.tsx` ya no existe y la home vive en `app/(cliente)/page.tsx`, dentro del route group, para heredar el header de marca.
- El mockup visual está en `design/qualita-boceto.html` (AGENTS.md lo nombra `qualita-plataforma-completa.html`; el archivo real es el primero).
- `.env.local` existe y está gitignoreado (`.env*`). Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANALYSIS_MODE` (`live` para llamar a Claude; sin ella, mock), `WEBSEARCH_MAX_USES` (tope de búsquedas web por auditoría; sin ella rige el default del código, en 0 se apaga), `AUDITORIA_MAX_USD` (tope de gasto en dólares por diagnóstico, sumando reprocesos; sin ella, 4 — ver `permisoGasto` en `lib/analysis/costo.ts`), `PAGESPEED_API_KEY`, y para el mail del informe `RESEND_API_KEY`, `EMAIL_FROM` y `APP_URL`. Sin las tres del mail, el análisis corre igual y el step `email` devuelve `enviado: false`. En producción, además, `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY`.

## Arquitectura

### Frontera servidor/cliente (la restricción que ordena todo)

Dos clientes de Supabase, deliberadamente separados:

- `lib/supabase/client.ts` → `createBrowserClient` con la anon/publishable key. Único importable desde componentes cliente.
- `lib/supabase/admin.ts` → `createClient` con `SUPABASE_SERVICE_ROLE_KEY` y `persistSession: false`. **Ignora RLS.** Solo route handlers / server actions.

RLS está activo en las 3 tablas pero sin policies, así que hoy *toda* lectura y escritura pasa por `admin.ts`. Consecuencia práctica: cualquier feature nueva que toque datos necesita un route handler o server action; no hay camino de acceso directo desde el browser. Lo mismo aplica a `ANTHROPIC_API_KEY` y a `docs/metodologia-diagnostico.md`, que no se sirven al browser.

Alias de import: `@/*` → raíz del repo.

### Pipeline del diagnóstico

El ciclo de vida vive en la columna `diagnostics.status`: `pending → analyzing → preliminary → sent` (o `failed`). `preliminary` es el resultado crudo del pipeline; `sent` significa que un humano de Qualita lo revisó. El informe público solo debería mostrar como oficial lo que llegó a `sent`.

`POST /api/diagnostics` (`app/api/diagnostics/route.ts`) es el único endpoint implementado y hace 4 escrituras en secuencia: `companies` → `diagnostics` (en `pending`) → `share_tokens` → devuelve `{ diagnosticId, token }`. El control de "1 diagnóstico por email" es el índice único sobre `lower(contact_email)`, detectado por el código de error Postgres `23505` → HTTP 409; no hay chequeo previo de existencia. El paso 5 publica el evento `diagnostic/requested` en Inngest y contesta; el análisis corre en `lib/inngest/functions.ts` (servido por `app/api/inngest/route.ts`), con `retries: 3` y `concurrency: 3`. Los steps: `pagespeed` (~50 s), el análisis partido en `lib/inngest/analisisPorPasos.ts` —`preparar` (carga y facts), `conversacion`, y por cada llamada a Claude un `claude-N` con `step.ai.infer` (la llamada la hace el servidor de Inngest mientras la función espera pausada, así una llamada de 7 minutos no choca con el `maxDuration = 300` de la ruta), `gasto-N`, `lecturas-N` cuando el modelo pide `leer_pagina`, y `guardar`— y `email` (`lib/email/informeListo.ts`: el link a `/d/[token]` por Resend, con `Idempotency-Key` por diagnóstico para que un reintento no lo duplique; los internos sin contacto se saltean). Los errores se clasifican en transitorios y permanentes (`retriable`): los transitorios se relanzan para que Inngest reintente SOLO ese step (los anteriores quedan memorizados: no se vuelven a pagar búsquedas) y, si se agotan, el `onFailure` de la función marca `failed`; los permanentes (incluida una respuesta que no valida tras 3 correcciones) se marcan enseguida y cortan con `NonRetriableError`. `runAnalysis` (`lib/analysis/analyze.ts`) sigue haciendo todo en un proceso con las mismas piezas (`prepararAnalisis`, `armarConversacion`, `guardarAnalisis`): lo usa la ruta de dev.

El análisis (`lib/analysis/`) es híbrido por diseño: chequeos **deterministas** en código (title/meta, URLs, vías de contacto, GA4/GTM/píxel, DMARC por DNS, PageSpeed) + interpretación con Claude sobre esos hechos + **investigación externa con búsqueda web** en modo live (`lib/analysis/websearch.ts`).

La búsqueda la ejecuta la API de Anthropic (server tool `web_search`, declarado en la llamada): posiciones en Google Argentina con las palabras del comprador, competencia —arranca por `companies.competidores` y completa hasta 3 detectando—, ficha de Google, redes, pauta, y las páginas internas del sitio del cliente tal como las indexó Google (título y descripción por página), con las que arma el bloque de arquitectura. Lo que la búsqueda NO puede ver marca el límite: no ejecuta el JavaScript del sitio, así que la medición se sigue resolviendo solo con los facts y los links rotos, los campos de un formulario y cualquier interacción quedan "a validar". El control de costo es el `max_uses` del tool (constante `MAX_BUSQUEDAS`, movible con `WEBSEARCH_MAX_USES`; en 0 no se busca y el prompt ni siquiera nombra esos bloques). Como el turno se vuelve largo, la llamada va por streaming y reanuda los `pause_turn`. Todo lo externo sale en bloques propios del JSON y no toca la madurez de los cinco canales del sitio. Además, en modo live el modelo tiene la herramienta propia `leer_pagina` (`lib/analysis/lecturas.ts`): la API frena con `stop_reason: "tool_use"`, el código corre los recolectores sobre la URL pedida (home de competidores, páginas internas del cliente) y le devuelve el resultado; las lecturas quedan en `results.lecturas` y de ahí sale la tabla de medición de la competencia. `fetchSite` va en modo `soloPublico` para esas URLs (anti-SSRF). El código guarda en `results.investigacion` qué se buscó, qué devolvió cada búsqueda y qué URLs citó el modelo sin que ninguna búsqueda las hubiera devuelto (`citasSinRespaldo`, la auditoría anti-invención); `method_version` suma el componente `websearch-x.y.z` cuando hubo búsqueda. El prompt es una versión condensada de `docs/metodologia-diagnostico.md` que devuelve JSON estructurado, un bloque por lámina de `docs/auditoria-ejemplo.html` (título + contenido + conclusión, con topes de caracteres porque la lámina es 16:9 fija). Hay dos contratos en `lib/analysis/schema.ts`: `analysisOutput` (generación: exige los bloques nuevos y los topes) y `analysisLectura` (lectura: acepta informes de antes de analysis-2.0.0); `lib/diagnostico/results.ts` usa el segundo. Un solo pilar: Arquitectura digital. La rúbrica puntúa 5 canales del sitio (`CANALES` en `schema.ts`), y el score 0-100 sale de los 6 canales del informe (`CANALES_SCORE` en `score.ts`): Sitio web y Medición desde esa rúbrica, y Google orgánico, Redes + ficha, Google Ads y Meta Ads desde la búsqueda (null = no se miró, no puntúa). Lo calcula `score.ts`, nunca el modelo, y tiene un techo: si algún canal del sitio está en madurez 1, el diagnóstico no puede pasar de 64 ("En desarrollo"). Todo lo no verificable se marca "a validar"; nunca se inventan cifras. Cada diagnóstico guarda su `method_version` para que informes viejos sigan siendo interpretables cuando cambie el método.

### Rutas

- `/` — landing corta (hero, cómo funciona, cierre), con los CTA apuntando a `/diagnostico`.
- `/diagnostico` — form en 2 pasos (empresa → contacto) con honeypot `company_website_url`; submit al route handler y redirección a `/analizando/[id]`.
- `/analizando/[id]` — pantalla de espera con polling de `/api/diagnostics/[id]/status`.
- `/d/[token]` — informe público, resuelto por `share_tokens.token` (no por id). `page.tsx` carga; `InformeDeck.tsx` decide qué láminas se dibujan y las numera; `Laminas.tsx` + `informe.module.css` son las láminas de `docs/auditoria-ejemplo.html`. Los componentes viejos del deck (`Deck.tsx`, `SeccionesDeck.tsx`, `HechosDeck.tsx`, `InvestigacionDeck.tsx`, `VelocidadDeck.tsx`, `HeroInforme.tsx`, `SeccionesInforme.tsx`) ya no se usan; `Canales.tsx` y `CierreInforme.tsx` los sigue usando la consola.
- `/app/*` — consola interna con login (Google) — leads/diagnósticos y revisión.

## Skills locales

`.agents/skills/` trae `frontend-design`, `web-design-guidelines` y `vercel-react-best-practices` (vendorizadas, con `skills-lock.json`). Las reglas de `vercel-react-best-practices/rules/` son la referencia para patrones de React/Next en este repo.
