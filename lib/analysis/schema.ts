import { z } from "zod";

/** Esquema de lo que devuelve Claude. Es el contrato: si la respuesta no
 *  valida contra esto, no se guarda. */

export const estadoCanal = z.enum([
  "activo",
  "parcial",
  "ausente",
  "fallas_criticas",
  "a_validar",
]);

const check = z.object({
  tipo: z.enum(["error", "alerta", "ok"]),
  titulo: z.string(),
  detalle: z.string(),
});

const canalInfra = z.object({
  madurez: z.number().int().min(1).max(5),
  estado: estadoCanal,
  insight: z.string(),
  checks: z.array(check).max(8),
});

const canalAValidar = z.object({
  estado: z.literal("a_validar"),
  insight: z.string(),
});

export const analysisOutput = z.object({
  resumen: z.string(),
  infra: z.object({
    sitio: canalInfra,
    seo: canalInfra,
    medicion: canalInfra,
    google_ads: canalAValidar,
    meta_ads: canalAValidar,
  }),
  fugas: z
    .array(
      z.object({
        titulo: z.string(),
        que_se_pierde: z.string(),
      }),
    )
    .min(1)
    .max(3),
});

export type AnalysisOutput = z.infer<typeof analysisOutput>;
