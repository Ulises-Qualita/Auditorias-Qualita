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
- `.env.local` existe y está gitignoreado (`.env*`). Las 4 variables ya están cargadas.

## Arquitectura

### Frontera servidor/cliente (la restricción que ordena todo)

Dos clientes de Supabase, deliberadamente separados:

- `lib/supabase/client.ts` → `createBrowserClient` con la anon/publishable key. Único importable desde componentes cliente.
- `lib/supabase/admin.ts` → `createClient` con `SUPABASE_SERVICE_ROLE_KEY` y `persistSession: false`. **Ignora RLS.** Solo route handlers / server actions.

RLS está activo en las 3 tablas pero sin policies, así que hoy *toda* lectura y escritura pasa por `admin.ts`. Consecuencia práctica: cualquier feature nueva que toque datos necesita un route handler o server action; no hay camino de acceso directo desde el browser. Lo mismo aplica a `ANTHROPIC_API_KEY` y a `docs/metodologia-diagnostico.md`, que no se sirven al browser.

Alias de import: `@/*` → raíz del repo.

### Pipeline del diagnóstico

El ciclo de vida vive en la columna `diagnostics.status`: `pending → analyzing → preliminary → sent` (o `failed`). `preliminary` es el resultado crudo del pipeline; `sent` significa que un humano de Qualita lo revisó. El informe público solo debería mostrar como oficial lo que llegó a `sent`.

`POST /api/diagnostics` (`app/api/diagnostics/route.ts`) es el único endpoint implementado y hace 4 escrituras en secuencia: `companies` → `diagnostics` (en `pending`) → `share_tokens` → devuelve `{ diagnosticId, token }`. El control de "1 diagnóstico por email" es el índice único sobre `lower(contact_email)`, detectado por el código de error Postgres `23505` → HTTP 409; no hay chequeo previo de existencia. El paso 5 publica el evento `diagnostic/requested` en Inngest y contesta; el análisis corre en `lib/inngest/functions.ts` (servido por `app/api/inngest/route.ts`), con `retries: 3` y `concurrency: 3`. `runAnalysis` clasifica sus errores en transitorios y permanentes (`retriable`): los transitorios se relanzan para que Inngest reintente y recién marcan `failed` en el último intento; los permanentes cortan con `NonRetriableError` y se marcan enseguida.

El análisis en sí (Fase 3, `lib/analysis/`, todavía no escrito) es híbrido por diseño: chequeos **deterministas** en código (title/meta, URLs, GA4/GTM/píxel, DMARC por DNS, PageSpeed) + interpretación con Claude sobre esos hechos. El prompt es una versión condensada de `docs/metodologia-diagnostico.md` que devuelve JSON estructurado (scores + hallazgos por canal, agrupados en los 2 pilares) — no el deck que describe el doc. Todo lo no verificable se marca "a validar"; nunca se inventan cifras. Cada diagnóstico guarda su `method_version` para que informes viejos sigan siendo interpretables cuando cambie el método.

### Rutas

- `/` — landing corta (hero, cómo funciona, cierre), con los CTA apuntando a `/diagnostico`.
- `/diagnostico` — form en 2 pasos (empresa → contacto) con honeypot `company_website_url`; submit al route handler y redirección a `/analizando/[id]`.
- `/analizando/[id]` — pantalla de espera con polling de `/api/diagnostics/[id]/status`.
- `/d/[token]` — informe público, resuelto por `share_tokens.token` (no por id). Plan de acción gateado detrás del CTA.
- `/app/*` — consola interna con login (Google) — leads/diagnósticos y revisión.

## Skills locales

`.agents/skills/` trae `frontend-design`, `web-design-guidelines` y `vercel-react-best-practices` (vendorizadas, con `skills-lock.json`). Las reglas de `vercel-react-best-practices/rules/` son la referencia para patrones de React/Next en este repo.
