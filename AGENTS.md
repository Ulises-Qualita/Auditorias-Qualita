# Proyecto: Autodiagnóstico Digital — Qualita Studio

Estoy construyendo una plataforma donde una empresa completa un formulario y recibe un diagnóstico automático de su presencia digital. El análisis lo genera Claude vía API, en el servidor. Es un producto de Qualita Studio (agencia de marketing, Bahía Blanca, Argentina). Tiene dos vistas: la del cliente (form + informe) y una consola interna para el equipo de Qualita.

## Stack
- Next.js (App Router, TypeScript, Tailwind)
- Supabase (Postgres + Auth), usando @supabase/ssr
- Anthropic SDK (@anthropic-ai/sdk) — SOLO en servidor
- zod para validación, cheerio para chequeos del sitio

## Estado actual (ya hecho, no rehacer)
- Proyecto creado, dependencias instaladas, `.env.local` cargado.
- Supabase con 3 tablas: `companies`, `diagnostics`, `share_tokens`.
  - `companies`: name, website, industry, province, client_type, contact_name, contact_email, created_at.
  - `diagnostics`: company_id, status (pending|analyzing|preliminary|sent|failed), lead_status (nuevo|contactado|conversacion|cliente|descartado), score_general, score_marca, score_infra, results (jsonb), method_version, reviewed_by, created_at, updated_at.
  - `share_tokens`: token (uuid), diagnostic_id, created_at.
  - RLS activado en las 3, SIN policies todavía (todo pasa por el servidor con la secret key).
  - Índice único: `companies (lower(contact_email))` → 1 diagnóstico por email.
- Clientes de Supabase en `lib/supabase/client.ts` (browser, publishable key) y `lib/supabase/admin.ts` (servidor, secret key, ignora RLS).
- Route handler `app/api/diagnostics/route.ts`: valida con zod, crea company + diagnostic + share_token, maneja el email duplicado (error 23505 → 409).

## Variables de entorno (ya existen en .env.local)
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable)
- SUPABASE_SERVICE_ROLE_KEY (secret), ANTHROPIC_API_KEY

## Reglas duras (importantes)
- La ANTHROPIC_API_KEY y la SUPABASE_SERVICE_ROLE_KEY NUNCA llegan al browser. Todo lo que las use corre en servidor (route handlers / server actions).
- El análisis con Claude corre en el servidor, nunca en el cliente.
- El pipeline mezcla chequeos DETERMINISTAS (con código: title/meta, URLs, GA4/GTM/píxel, DMARC por DNS, PageSpeed) + interpretación con Claude. Lo que no se puede verificar se marca "a validar", NUNCA se inventa (ni cifras de inversión, ni métricas).
- El diagnóstico tiene UN solo pilar: **"Arquitectura digital"**. El pilar "Marca implementadora" se sacó (2026-09-09): nunca tuvo datos y la auditoría real de Qualita no se organiza en pilares. Las columnas `score_marca` y el campo `pilar_marca` siguen en la base para que los informes viejos parseen, pero no se calculan ni se muestran.
- El informe se organiza por CANALES, en el orden del recorrido del comprador: Sitio web, Vías de contacto, Cómo está ordenado el sitio, Qué ve Google (on-page) y Medición (incluye DMARC).
- Los canales que hoy NO se pueden verificar con código (posiciones en Google, Google Ads, Meta Ads, redes, ficha de Google, competencia) se OMITEN del informe. No se muestran vacíos, ni "a validar", ni gateados: esta versión no los promete.
- Cada diagnóstico guarda su method_version.
- Antes de mostrarse "oficial" al cliente, un humano lo revisa (status pasa a 'sent').

## Flujo del producto
1. Empresa completa el form (1 paso por ahora: datos de empresa + contacto/email al final). No hay paso de redes todavía.
2. Submit → crea registros → dispara análisis en background.
3. Pantalla "analizando" con polling del status.
4. Informe público en /d/[token], con la estructura de la auditoría de referencia: tesis de portada → lo que ya tienen → el recorrido → resumen de canales (escala de 5 puntos) → detalle por canal con evidencia → puntos de fuga → plan (gateado detrás del CTA) → "en una página" → lo que quedó a validar.
5. Consola interna (con login) para ver leads/diagnósticos y revisarlos.

## Cómo quiero trabajar
- Andá paso a paso, un archivo o feature a la vez. Explicá brevemente qué hacés y por qué.
- No reescribas lo que ya funciona sin avisar. Respetá la estructura y las convenciones existentes.
- Preguntá si algo es ambiguo en vez de asumir.
- Priorizá seguridad (claves, RLS) y no inventar datos.

## Metodología del diagnóstico (fuente de verdad del análisis)
La lógica completa del diagnóstico está en `docs/metodologia-diagnostico.md`: qué se investiga en cada canal, el análisis de arquitectura (cómo piensa la empresa vs. cómo busca el comprador), el mapa del sector, las reglas anti-invención, el scoring por canal y el Método Qualita en 6 pasos.

- Es la referencia de calidad: cualquier output del análisis debe estar a la altura de ese documento.
- El prompt real que se le pasa a la API de Claude es una versión DERIVADA y condensada de ese doc, adaptada para devolver JSON estructurado (hallazgos por canal + las secciones del informe), no un deck. Vive en `lib/analysis/prompt.ts`.
- Reglas que salen de ahí y son innegociables: no inventar cifras (inversión, impresiones, presupuestos), marcar lo no verificable como "a validar", y separar chequeos deterministas (código) de interpretación (Claude).
- Ese archivo NO se importa en el cliente ni se sirve al browser.

# Especificaciones de diseño — Qualita Studio

La identidad ya está definida por el manual de marca. Respetala al pie; no inventes otra dirección visual.

## Tipografías (Google Fonts)
- **Unbounded** — títulos, números grandes y destacados. Pesos 500/600/700. Es display, geométrica, con personalidad.
- **DM Sans** — todo el cuerpo de texto, tablas, labels, botones. Pesos 400/500/600/700.
- **Poppins** — SOLO en los títulos de las láminas del informe del cliente (`/d/[token]`, debajo del hero), porque el informe sigue el deck `docs/referencia-diseno-informe.html`. Se carga con `next/font` en `app/(cliente)/d/[token]/Deck.tsx` y se aplica con `.lamina`. El hero del informe, la landing y la consola siguen en Unbounded.
- Dongle es SOLO para el logo; no se usa en la UI.
- Importar ambas de Google Fonts.

## Paleta (valores exactos, no aproximar)
- `--navy: #252851` — color estructural y de texto sobre fondo claro. Base de las secciones oscuras. Es el "oscuro" de la marca (NO usar negro puro).
- `--magenta: #B50CC5` — acento principal (énfasis, datos destacados, kickers).
- `--coral: #FE6F61` — segundo acento (Infraestructura, alertas, el guion de los kickers).
- `--blanco: #FFFFFF`
- `--crema: #FFF4EC` — fondo suave alternativo para bandas de sección.
- Grises de UI derivados: bg `#f5f5fb`, borde `#eaeaf2`, texto tenue `#6b6d86`, texto muy tenue `#a0a2b6`.
- Estados: ok verde `#1f9d63`, alerta/rojo `#e0492f`, medio/ámbar `#b57400`, info/violeta-azul `#4a54c4`. Cada uno con su versión de fondo suave (~10% de opacidad).

## Gradientes
- Principal (botones, acentos): `linear-gradient(100deg, #FE6F61, #B50CC5)` (coral→magenta).
- Violeta (del manual de marca) → `linear-gradient(90deg, #d95cf5, #a915c4)`.
- Coral → `linear-gradient(90deg, #ff9084, #FE6F61)`.
- Oscuro/degradé de marca: `linear-gradient(125deg, #B50CC5, #252851)` (magenta→navy).
- Usarlos con moderación, sin tapar la legibilidad.

## Recursos de marca (firma visual)
- El **asterisco** `*` (en Unbounded) como elemento recurrente en heros y CTAs.
- **Auras**: orbes de gradiente desenfocados (blur ~90px, baja opacidad) magenta/coral sobre fondos navy oscuros.
- **Kicker con guion**: etiqueta en mayúscula + letter-spacing, precedida de una rayita coral de ~20px (eyebrow editorial).
- Tarjetas **glass** (fondo blanco translúcido + blur) sobre fondos oscuros.

## Sistema de UI
- Radio de bordes: ~14–16px en tarjetas, ~10–12px en inputs/botones.
- Sombras suaves y sutiles (no marcadas): `0 1px 2px rgba(37,40,81,.04), 0 6px 18px rgba(37,40,81,.05)`. Elevación un poco mayor en hover.
- Botones: primario = gradiente coral→magenta, texto blanco, pill/redondeado. Secundario = fondo blanco, borde gris, texto navy.
- Kickers en mayúscula, `letter-spacing: .2em`, color magenta (o coral sobre oscuro).
- Jerarquía: kicker → título grande en Unbounded → cuerpo corto en DM Sans. Mucho aire.
- Respetar `prefers-reduced-motion`.

## Antipatrones (evitar "look de IA genérico")
- Nada de emojis como iconos (usar SVG).
- Nada de texto en gradiente tipo plantilla (usar color sólido o un resaltador coral detrás de una palabra clave).
- No llenar todo de tarjetas iguales con sombra fuerte; variar ritmo y usar bandas de color intencionales.
- No usar negro puro (#000): el oscuro es siempre `#252851` o `#0e0f1e/#111327` para fondos.
- Evitar la "dona de score" genérica; preferir escalas/barras con contexto.

## Dos vistas, dos tonos
- **Vista empresa (cliente):** cálida, guiada, en "vos" argentino, lenguaje claro sin tecnicismos. Hero oscuro con auras + asterisco, con la tesis del diagnóstico como titular y una tarjeta glass de score; el cuerpo va por canales, con la escala de 5 puntos de la auditoría (nada de donas).
- **Vista Qualita (consola):** más densa y sobria, tipo SaaS. Sidebar navy, workspace claro, tablas, pills de estado, drawers. Acá sí puede ser más técnica (checklists ✕/!/✓ por vertical).

## Estados y colores semánticos (diagnóstico)
- Estado de canal: "Activo" (verde), "Parcial" (ámbar/magenta), "Ausente" (gris), "Fallas críticas" (rojo).
- Nivel de madurez general: Inicial (0–39, rojo), En desarrollo (40–64, ámbar), Sólido (65–100, verde).
- Estado de lead (consola): nuevo (info), contactado (ámbar), en conversación (magenta), cliente (verde), descartado (gris).
## Referencia
Tengo un mockup HTML funcional en la carpeta /design (el archivo real es `qualita-boceto.html`) con la identidad aplicada: form, dashboard, tabla de leads, drawer y detalle con tabs. Úsalo como fuente de verdad de tokens, componentes y microcopy en vez de inventar.

**Excepción: el informe del cliente.** Su estructura y su tono salen de `docs/ejemplo-auditoria-audifarm.pdf`, no del mockup (que todavía muestra el informe viejo de 2 pilares). El PDF manda para qué secciones hay y en qué orden; el mockup manda para cómo se ven.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.


## Referencia de calidad del análisis
`docs/ejemplo-auditoria-audifarm.pdf` es una auditoría REAL hecha a mano por Qualita, al nivel que el output automático debe alcanzar. 
- Es el ESTÁNDAR de calidad y tono (voz al cliente, hallazgos concretos atados a evidencia, honestidad sobre lo no verificable), NO un template ni datos para reusar.
- NUNCA copiar su contenido, cifras, competidores ni frases a otros diagnósticos: cada informe sale solo de los facts de ESA empresa.
- Sirve para calibrar el prompt (lib/analysis/prompt.ts) y, a futuro, el diseño del render.
<!-- END:nextjs-agent-rules -->
