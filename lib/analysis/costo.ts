/** Costo real de cada análisis, calculado desde el `usage` que devuelve la API.
 *
 *  No es una estimación: la respuesta de Messages trae los tokens exactos que
 *  se facturaron. Acá solo los multiplicamos por el precio del modelo.
 *
 *  Sin imports de servidor: lo usa el pipeline (servidor) y la consola para
 *  formatear, y no toca ninguna key. */

/** Precios en dólares por millón de tokens (tarifa Anthropic first-party).
 *
 *  Fuente: tabla de precios de la API. Si Anthropic cambia una tarifa o se
 *  cambia de modelo, se toca ACÁ y nada más — pero los diagnósticos ya
 *  guardados conservan el costo que se calculó el día que corrieron, que es lo
 *  correcto: reconstruirlo con precios nuevos daría un número que nunca se
 *  pagó. */
export const PRECIOS: Record<string, Precio> = {
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/** Cada búsqueda web del análisis (tool `web_search` de Anthropic) se cobra
 *  aparte de los tokens: USD 10 por cada 1.000 búsquedas. Los resultados que
 *  entran al contexto se pagan además como tokens de input, y eso ya viene
 *  contado en `usage`. */
export const PRECIO_BUSQUEDA_WEB = 10 / 1000;

export type Precio = {
  input: number;
  output: number;
  /** Lectura de caché: ~0,1x el input. */
  cacheRead: number;
  /** Escritura de caché: ~1,25x el input. */
  cacheWrite: number;
};

/** Lo que consumió un análisis. Se ACUMULA entre intentos: si el JSON no
 *  validó y hubo que pedirlo de nuevo, esa segunda llamada también se pagó y
 *  tiene que estar contada. */
export type UsoAnalisis = {
  modelo: string;
  /** Cuántas llamadas a la API hicieron falta (1 normalmente, 2 con corrección). */
  llamadas: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Búsquedas web que hizo el modelo (server tool de Anthropic). 0 en mock y
   *  en las corridas anteriores a analysis-1.8.0, que no buscaban. */
  busquedasWeb: number;
  /** Dólares. Calculado con los precios vigentes al momento de la corrida. */
  costoUsd: number;
};

export const USO_VACIO: Omit<UsoAnalisis, "modelo"> = {
  llamadas: 0,
  busquedasWeb: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costoUsd: 0,
};

/** La forma del `usage` de la API. Declarada suelta para no atar este módulo
 *  al SDK: los campos de caché pueden no venir. */
export type UsageApi = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  /** Lo que gastaron las herramientas de servidor. Hoy solo miramos las
   *  búsquedas web; viene null cuando la llamada no usó ninguna. */
  server_tool_use?: { web_search_requests?: number | null } | null;
};

/** Suma una llamada al acumulado. Devuelve un objeto nuevo (no muta). */
export function acumularUso(
  previo: UsoAnalisis,
  usage: UsageApi | null | undefined,
): UsoAnalisis {
  const sumado: UsoAnalisis = {
    ...previo,
    llamadas: previo.llamadas + 1,
    inputTokens: previo.inputTokens + (usage?.input_tokens ?? 0),
    outputTokens: previo.outputTokens + (usage?.output_tokens ?? 0),
    cacheReadTokens: previo.cacheReadTokens + (usage?.cache_read_input_tokens ?? 0),
    cacheWriteTokens: previo.cacheWriteTokens + (usage?.cache_creation_input_tokens ?? 0),
    busquedasWeb:
      (previo.busquedasWeb ?? 0) + (usage?.server_tool_use?.web_search_requests ?? 0),
  };
  return { ...sumado, costoUsd: calcularCosto(sumado) };
}

/** Un modelo sin precio conocido no suma costo de tokens, en vez de inventar
 *  un número: el campo `llamadas` sigue siendo verdad y deja ver que la
 *  corrida existió. Las búsquedas web se cobran igual, porque su precio no
 *  depende del modelo. `busquedasWeb` puede faltar en un uso guardado antes
 *  de analysis-1.8.0; ahí vale 0. */
export function calcularCosto(uso: Omit<UsoAnalisis, "costoUsd">): number {
  // Un ID con fecha (`claude-haiku-4-5-20251001`) cobra lo mismo que el alias.
  const precio = PRECIOS[uso.modelo] ?? PRECIOS[uso.modelo.replace(/-\d{8}$/, "")];
  const tokens = precio
    ? (uso.inputTokens * precio.input +
        uso.outputTokens * precio.output +
        uso.cacheReadTokens * precio.cacheRead +
        uso.cacheWriteTokens * precio.cacheWrite) /
      1_000_000
    : 0;

  const dolares = tokens + (uso.busquedasWeb ?? 0) * PRECIO_BUSQUEDA_WEB;

  // 6 decimales: un análisis cuesta centavos, y redondear a 2 lo mostraría
  // como $0.00.
  return Math.round(dolares * 1e6) / 1e6;
}

export function usoInicial(modelo: string): UsoAnalisis {
  return { modelo, ...USO_VACIO };
}

/** TOPE DE GASTO POR AUDITORÍA, en dólares.
 *
 *  Una corrida de Sonnet 5 con 28 búsquedas costó USD 9,97: el turno de la
 *  búsqueda releyó 3,8 millones de tokens. El caché lo abarata, pero no pone
 *  techo; esto sí. Se controla ENTRE llamadas a la API (una llamada ya
 *  lanzada no se puede cortar a la mitad), con una reserva para poder
 *  cerrar el informe: pasado cierto gasto se deja de investigar y se le pide
 *  al modelo el JSON con lo que ya tiene.
 *
 *  El tope es POR DIAGNÓSTICO, no por corrida: lo que ya quedó en el libro de
 *  gasto (`analysis_costs`) de corridas anteriores del mismo diagnóstico —un
 *  reproceso desde la consola, un evento repetido— entra como `previo`. Así un
 *  diagnóstico no puede pagar dos veces el tope entero.
 *
 *  Se puede mover con AUDITORIA_MAX_USD. */
export const TOPE_USD_AUDITORIA = 4;

export function topeUsdAuditoria(): number {
  const crudo = process.env.AUDITORIA_MAX_USD?.trim();
  if (!crudo) return TOPE_USD_AUDITORIA;
  const valor = Number.parseFloat(crudo);
  return Number.isFinite(valor) && valor > 0 ? valor : TOPE_USD_AUDITORIA;
}

/** Lo que se estima que cuesta la llamada que cierra el informe: releer el
 *  contexto de una auditoría (~200.000 tokens) a precio completo —el cambio de
 *  `tool_choice` invalida el caché de los mensajes— y escribir el JSON con su
 *  razonamiento. Un modelo sin precio conocido da 0, igual que su costo.
 *
 *  La salida era 32.000 y quedaba corta: la última llamada de una corrida real
 *  con Sonnet 5 (2026-09-22) escribió 50.842 tokens entre razonamiento y JSON.
 *  Con Opus esa diferencia son ~USD 0,50 y el tope se podía pasar. */
const CONTEXTO_CIERRE_TOKENS = 200_000;
const SALIDA_CIERRE_TOKENS = 52_000;

export function reservaCierre(modelo: string): number {
  const precio = PRECIOS[modelo] ?? PRECIOS[modelo.replace(/-\d{8}$/, "")];
  if (!precio) return 0;
  return (CONTEXTO_CIERRE_TOKENS * precio.input + SALIDA_CIERRE_TOKENS * precio.output) / 1_000_000;
}

/** Qué se permite hacer con la próxima llamada, según lo gastado:
 *  - "seguir": investigar (búsquedas, lecturas) queda con margen para cerrar y
 *    para una corrección del JSON.
 *  - "cerrar": solo una llamada sin herramientas que devuelva el JSON.
 *  - "cortar": ni siquiera eso entra en el tope; la corrida termina en fallo.
 */
export type PermisoGasto = "seguir" | "cerrar" | "cortar";

export function permisoGasto(uso: UsoAnalisis, tope: number, previo = 0): PermisoGasto {
  const reserva = reservaCierre(uso.modelo);
  const gastado = previo + uso.costoUsd;
  if (gastado + 2 * reserva <= tope) return "seguir";
  if (gastado + reserva <= tope) return "cerrar";
  return "cortar";
}

/** Formato para la consola. Debajo de un centavo mostramos 4 decimales: con 2
 *  todos los diagnósticos se verían como "$0.00" y el dato no serviría. */
export function formatearUsd(dolares: number | null | undefined): string {
  if (dolares == null) return "—";
  if (dolares === 0) return "$0";
  if (dolares < 0.01) return `$${dolares.toFixed(4)}`;
  if (dolares < 1) return `$${dolares.toFixed(3)}`;
  return `$${dolares.toFixed(2)}`;
}

/** Los pesos son lo que el equipo entiende de un vistazo, pero el precio real
 *  es en dólares: la conversión es informativa y necesita una cotización que
 *  no tenemos en la app. Por eso NO se convierte acá; si algún día se quiere,
 *  la cotización tiene que entrar como dato, no como constante hardcodeada. */
