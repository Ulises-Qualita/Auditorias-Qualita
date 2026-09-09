import { NonRetriableError } from "inngest";
import { runAnalysis } from "@/lib/analysis/analyze";
import { diagnosticRequested, inngest } from "./client";

/** Cuántos análisis corren a la vez. El techo real es el costo de la API de
 *  Claude, no la CPU: con `ANALYSIS_MODE=live` cada corrida es una llamada
 *  paga. Subilo cuando el volumen lo pida y el gasto esté medido. */
const CONCURRENCIA = 3;

/** Reintentos ANTE FALLOS TRANSITORIOS. Con 3, Inngest corre hasta 4 veces
 *  (intento 0 + 3 reintentos) con backoff exponencial. */
const REINTENTOS = 3;

/** El análisis del diagnóstico, fuera del request.
 *
 *  El manejo de errores es el punto fino: `runAnalysis` nunca tira, devuelve
 *  `{ ok: false, retriable }`. Acá lo traducimos a lo que Inngest entiende:
 *  - transitorio (red, API de Anthropic, Supabase) → tiramos un Error común y
 *    se reintenta;
 *  - permanente (el diagnóstico no existe, no tiene empresa, el mock no cumple
 *    el esquema) → `NonRetriableError`, porque volver a correrlo daría igual.
 *
 *  El 'failed' en la base sigue esa misma división: un fallo permanente se
 *  escribe enseguida, y uno transitorio recién en el último intento. Mientras
 *  queden reintentos el diagnóstico sigue en 'analyzing' y el cliente ve la
 *  pantalla de análisis, no un fallo que todavía se puede reparar solo. */
export const runAnalysisFn = inngest.createFunction(
  {
    id: "run-analysis",
    retries: REINTENTOS,
    concurrency: { limit: CONCURRENCIA },
    triggers: [diagnosticRequested],
  },
  async ({ event, step, attempt }) => {
    const { diagnosticId } = event.data;
    const ultimoIntento = attempt >= REINTENTOS;

    const resultado = await step.run("analyze", async () => {
      const salida = await runAnalysis(diagnosticId, {
        marcarFalloTransitorio: ultimoIntento,
      });

      if (salida.ok) return salida;

      if (!salida.retriable) {
        // step.run no reintenta lo que ya se sabe que no va a cambiar, y el
        // run queda visible como fallado en el dashboard.
        throw new NonRetriableError(salida.error);
      }

      throw new Error(salida.error);
    });

    return { diagnosticId, scores: resultado.scores };
  },
);

export const functions = [runAnalysisFn];
