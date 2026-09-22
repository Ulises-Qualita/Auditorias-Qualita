import { NonRetriableError } from "inngest";
import { medirVelocidad } from "@/lib/analysis/analyze";
import type { PageSpeedFacts } from "@/lib/analysis/collectors/pageSpeed";
import { enviarInformeListo, ErrorMailTransitorio } from "@/lib/email/informeListo";
import { createAdminClient } from "@/lib/supabase/admin";
import { analizarPorPasos } from "./analisisPorPasos";
import { diagnosticRequested, inngest } from "./client";

/** Cuántos análisis corren a la vez. El techo real es el costo de la API de
 *  Claude, no la CPU: con `ANALYSIS_MODE=live` cada corrida es una llamada
 *  paga. Subilo cuando el volumen lo pida y el gasto esté medido. */
const CONCURRENCIA = 3;

/** Reintentos ANTE FALLOS TRANSITORIOS, por step. Con 3, Inngest corre cada
 *  step hasta 4 veces con backoff exponencial. Como cada step queda
 *  memorizado, reintentar uno no repite los anteriores: una caída de la base
 *  al guardar no vuelve a pagar las búsquedas. */
const REINTENTOS = 3;

/** El análisis del diagnóstico, fuera del request y partido en steps (ver
 *  analisisPorPasos.ts): cada llamada a Claude es un `step.ai.infer`, que la
 *  hace el servidor de Inngest mientras la función espera pausada. Así
 *  ninguna llamada larga corre adentro de la función ni choca con el
 *  `maxDuration` de /api/inngest.
 *
 *  Los errores:
 *  - transitorio (red, la base, la API de Anthropic) → el step tira un Error
 *    común e Inngest reintenta solo ese step;
 *  - permanente (el diagnóstico no existe, la respuesta no validó tras las
 *    correcciones) → se escribe 'failed' enseguida y `NonRetriableError`.
 *  Si un fallo transitorio agota los reintentos, `onFailure` escribe el
 *  'failed': mientras quedaban reintentos el cliente seguía viendo la
 *  pantalla de análisis, no un fallo que se podía reparar solo. */
export const runAnalysisFn = inngest.createFunction(
  {
    id: "run-analysis",
    retries: REINTENTOS,
    concurrency: { limit: CONCURRENCIA },
    triggers: [diagnosticRequested],
    onFailure: async ({ event, error }) => {
      const diagnosticId = event.data.event.data.diagnosticId;
      // Solo si sigue en curso: un fallo permanente ya dejó su motivo, y no
      // hay que pisarlo con uno más genérico.
      await createAdminClient()
        .from("diagnostics")
        .update({
          status: "failed",
          results: { error: error.message, fallo_en: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq("id", diagnosticId)
        .in("status", ["pending", "analyzing"]);
    },
  },
  async ({ event, step }) => {
    const { diagnosticId } = event.data;

    // PageSpeed va primero y aparte: tarda ~50 s. Nunca tira, así que se
    // memoriza en la primera corrida. (El step devuelve JSON: el tipo se
    // reafirma porque Inngest lo serializa.)
    const velocidad = (await step.run("pagespeed", () =>
      medirVelocidad(diagnosticId),
    )) as PageSpeedFacts | null;

    const resultado = await analizarPorPasos(step, diagnosticId, velocidad);

    // El mail con el link, en su propio step: si Resend falla se reintenta
    // solo esto (el análisis ya quedó memorizado). Un fallo permanente —dominio
    // sin verificar, diagnóstico interno sin email— no tira: vuelve como
    // `enviado: false` y se ve en el dashboard de Inngest.
    const mail = await step.run("email", async () => {
      try {
        return await enviarInformeListo(diagnosticId);
      } catch (error) {
        if (error instanceof ErrorMailTransitorio) throw error;
        const detalle = error instanceof Error ? error.message : "error desconocido";
        throw new NonRetriableError(`No se pudo enviar el mail: ${detalle}`);
      }
    });

    return { diagnosticId, scores: resultado.scores, mail };
  },
);

export const functions = [runAnalysisFn];
