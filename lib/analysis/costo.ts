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
  /** Dólares. Calculado con los precios vigentes al momento de la corrida. */
  costoUsd: number;
};

export const USO_VACIO: Omit<UsoAnalisis, "modelo"> = {
  llamadas: 0,
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
  };
  return { ...sumado, costoUsd: calcularCosto(sumado) };
}

/** Un modelo sin precio conocido devuelve costo 0, no un número inventado. El
 *  campo `llamadas` sigue siendo verdad y deja ver que la corrida existió. */
export function calcularCosto(uso: Omit<UsoAnalisis, "costoUsd">): number {
  // Un ID con fecha (`claude-haiku-4-5-20251001`) cobra lo mismo que el alias.
  const precio = PRECIOS[uso.modelo] ?? PRECIOS[uso.modelo.replace(/-\d{8}$/, "")];
  if (!precio) return 0;

  const dolares =
    (uso.inputTokens * precio.input +
      uso.outputTokens * precio.output +
      uso.cacheReadTokens * precio.cacheRead +
      uso.cacheWriteTokens * precio.cacheWrite) /
    1_000_000;

  // 6 decimales: un análisis cuesta centavos, y redondear a 2 lo mostraría
  // como $0.00.
  return Math.round(dolares * 1e6) / 1e6;
}

export function usoInicial(modelo: string): UsoAnalisis {
  return { modelo, ...USO_VACIO };
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
