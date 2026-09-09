import { z } from "zod";

import { diagnosticResults } from "@/lib/diagnostico/results";

/** El contrato de lectura de `results` para la vista INTERNA.
 *
 *  `lib/diagnostico/results.ts` descarta `facts` a propósito: el informe
 *  público no debe recibir el blob de evidencia (incluye el listado completo
 *  de URLs internas del sitio). Acá pasa lo contrario —el equipo tiene que
 *  poder auditar de dónde salió cada afirmación— así que se declara aparte en
 *  vez de aflojar el esquema del cliente.
 *
 *  Todo es opcional y los objetos son `loose`: un results viejo, de una
 *  versión anterior del método, tiene que seguir abriéndose. La consola
 *  muestra lo que hay y calla lo que falta; nunca rompe. */

const url = z.object({
  href: z.string(),
  slug: z.string(),
  descriptiva: z.boolean(),
  motivo: z.string().nullish(),
});

const facts = z.looseObject({
  collectVersion: z.string().nullish(),
  collectedAt: z.string().nullish(),
  inputUrl: z.string().nullish(),
  finalUrl: z.string().nullish(),
  domain: z.string().nullish(),

  fetch: z
    .looseObject({
      ok: z.boolean().nullish(),
      finalUrl: z.string().nullish(),
      redirected: z.boolean().nullish(),
      status: z.number().nullish(),
      contentType: z.string().nullish(),
      elapsedMs: z.number().nullish(),
      error: z.string().nullish(),
    })
    .nullish(),

  seo: z
    .looseObject({
      title: z.string().nullish(),
      titleLength: z.number().nullish(),
      metaDescription: z.string().nullish(),
      metaDescriptionLength: z.number().nullish(),
      h1Count: z.number().nullish(),
      h1Texts: z.array(z.string()).nullish(),
      htmlLang: z.string().nullish(),
      canonical: z.string().nullish(),
      urlsInternas: z.array(url).nullish(),
      urlsInternasTotal: z.number().nullish(),
      urlsCripticas: z.number().nullish(),
    })
    .nullish(),

  tracking: z
    .looseObject({
      ga4: z.boolean().nullish(),
      gtm: z.boolean().nullish(),
      metaPixel: z.boolean().nullish(),
      googleAdsConversion: z.boolean().nullish(),
      universalAnalyticsLegacy: z.boolean().nullish(),
      ids: z.array(z.string()).nullish(),
      algunTagPresente: z.boolean().nullish(),
    })
    .nullish(),

  tech: z
    .looseObject({
      cms: z.string().nullish(),
      pageBuilder: z.string().nullish(),
      ecommerce: z.string().nullish(),
      libraries: z
        .array(
          z.looseObject({
            nombre: z.string(),
            version: z.string().nullish(),
            desactualizada: z.boolean().nullish(),
          }),
        )
        .nullish(),
      evidencia: z.array(z.string()).nullish(),
    })
    .nullish(),

  dmarc: z
    .looseObject({
      domain: z.string().nullish(),
      exists: z.boolean().nullish(),
      policy: z.string().nullish(),
      subdomainPolicy: z.string().nullish(),
      pct: z.number().nullish(),
      record: z.string().nullish(),
      error: z.string().nullish(),
    })
    .nullish(),

  pageSpeed: z
    .looseObject({
      disponible: z.boolean().nullish(),
      strategy: z.string().nullish(),
      performance: z.number().nullish(),
      lcpMs: z.number().nullish(),
      cls: z.number().nullish(),
      tbtMs: z.number().nullish(),
      medidoEn: z.string().nullish(),
      motivo: z.string().nullish(),
    })
    .nullish(),

  warnings: z.array(z.string()).nullish(),
});

export const resultsInterno = diagnosticResults.extend({ facts: facts.nullish() });

export type ResultsInterno = z.infer<typeof resultsInterno>;
export type FactsInterno = z.infer<typeof facts>;

export function parseResultsInterno(raw: unknown): ResultsInterno | null {
  const validado = resultsInterno.safeParse(raw);
  return validado.success ? validado.data : null;
}

/** Cuando el análisis falla, `runAnalysis` guarda el motivo en el mismo jsonb
 *  (no hay columna de error). Esto lo lee: es información interna y en la
 *  consola sí se muestra tal cual. */
export const resultsFallido = z.object({
  error: z.string(),
  fallo_en: z.string().nullish(),
});

export type ResultsFallido = z.infer<typeof resultsFallido>;

export function parseFallo(raw: unknown): ResultsFallido | null {
  const validado = resultsFallido.safeParse(raw);
  return validado.success ? validado.data : null;
}
