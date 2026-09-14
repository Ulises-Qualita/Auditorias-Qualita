/** Cuándo un análisis se puede volver a disparar desde la consola.
 *
 *  Vive acá, y no dentro del server action, porque la regla la necesitan dos
 *  lados: la action (que la aplica en el WHERE del update) y la página (que
 *  decide si dibuja el botón). Con la regla duplicada, tarde o temprano el
 *  botón aparece donde la action lo va a rechazar.
 *
 *  Sin imports de servidor, como el resto de lib/consola/leads.ts: lo importan
 *  server components y componentes cliente por igual. */

/** Un análisis en curso no se toca. Recién cuando pasó este rato sin que la
 *  fila se mueva damos por muerto el intento: `runAnalysis` escribe
 *  `updated_at` al arrancar cada intento, así que una corrida con los
 *  reintentos de Inngest (con backoff) sigue "fresca" mientras pelea. Diez
 *  minutos son holgados contra el peor caso real (~2 min). */
export const MINUTOS_COLGADO = 10;

/** Por qué se habilita el reintento. La UI lo usa para explicar en vez de
 *  mostrar un botón sin contexto. */
export type MotivoReintento = "failed" | "colgado";

/** `desde` es `updated_at ?? created_at`: la última señal de vida de la fila.
 *
 *  'failed' se reintenta siempre: por definición no quedó nada corriendo.
 *  'pending' y 'analyzing' esperan el umbral, porque en los dos casos puede
 *  haber un evento en vuelo y disparar otro significa correr el análisis dos
 *  veces —dos llamadas pagas a Claude escribiendo la misma fila. */
export function motivoReintento(
  status: string,
  desde: string | null,
  ahora: number = Date.now(),
): MotivoReintento | null {
  if (status === "failed") return "failed";
  if (status !== "pending" && status !== "analyzing") return null;

  const ultimaSenal = desde ? new Date(desde).getTime() : Number.NaN;
  // Sin fecha usable no podemos saber si está colgado; no ofrecemos el botón.
  if (Number.isNaN(ultimaSenal)) return null;

  return ahora - ultimaSenal >= MINUTOS_COLGADO * 60_000 ? "colgado" : null;
}
