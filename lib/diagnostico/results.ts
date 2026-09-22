import { z } from "zod";

import { analysisLectura, estadoCanal } from "@/lib/analysis/schema";

/** El contrato de lectura de `diagnostics.results`.
 *
 *  La columna es jsonb, así que Supabase la devuelve sin tipo. En vez de
 *  escribir un type a mano que se desincronice del pipeline, extendemos el
 *  mismo zod que valida la salida del análisis con los campos que
 *  `lib/analysis/analyze.ts` agrega al persistir.
 *
 *  `facts` NO está declarado a propósito: zod lo descarta (modo strip) y así
 *  el blob de evidencia —que incluye el listado completo de URLs internas—
 *  nunca llega como prop a un componente cliente. El informe público no lo
 *  necesita. */

/** Lo que se muestra de cada `leer_pagina` (lib/analysis/lecturas.ts): lo
 *  que usa la tabla de medición de la competencia. El resto lo descarta zod. */
const lecturaPagina = z.object({
  url: z.string(),
  para: z.enum(["cliente", "competidor"]),
  finalUrl: z.string().nullable(),
  dominio: z.string().nullable(),
  ok: z.boolean(),
  tracking: z
    .object({
      ga4: z.boolean(),
      gtm: z.boolean(),
      metaPixel: z.boolean(),
      googleAdsConversion: z.boolean(),
    })
    .nullable(),
  dmarc: z.object({ exists: z.boolean().nullable(), policy: z.string().nullable() }).nullable(),
});

/* `analysisLectura` y no `analysisOutput`: el contrato de lectura acepta
 * los informes de antes de analysis-2.0.0, que no traen los bloques de las
 * láminas nuevas. */
export const diagnosticResults = analysisLectura.extend({
  lecturas: z.array(lecturaPagina).optional().default([]),
  analysis_source: z.enum(["mock", "claude"]).optional(),
  a_validar: z.array(z.string()).optional().default([]),
  /** Lo que el pipeline guarda de la búsqueda web. Se declara SOLO lo que usa
   *  el informe —las fuentes para la nota de método y cuántas búsquedas se
   *  hicieron—: las queries crudas y las citas sin respaldo son material de
   *  auditoría del equipo y zod las descarta antes de que lleguen al render. */
  investigacion: z
    .object({
      hechas: z.number().optional(),
      fuentes: z
        .array(z.object({ titulo: z.string(), url: z.string() }))
        .optional()
        .default([]),
    })
    .optional(),
  // Informes viejos (v1, dos pilares) traen esto. Se acepta para que sigan
  // parseando, pero no se muestra ni se vuelve a escribir.
  pilar_marca: z.object({ estado: z.literal("a_validar") }).optional(),
});

export type DiagnosticResults = z.infer<typeof diagnosticResults>;
export type EstadoCanal = z.infer<typeof estadoCanal>;
export type CanalInforme = DiagnosticResults["canales"]["sitio"];
export type Check = CanalInforme["checks"][number];
export type Fuga = DiagnosticResults["fugas"][number];
/* Los bloques de investigación son opcionales en el esquema del análisis, así
 * que acá se exportan ya sin el null: los componentes los reciben cuando
 * existen y la lámina no se dibuja cuando no. */
export type Arquitectura = NonNullable<DiagnosticResults["arquitectura"]>;
export type PaginaInterna = NonNullable<DiagnosticResults["paginas"]>[number];
export type Competidor = NonNullable<DiagnosticResults["mapa_sector"]>[number];
export type Ranking = NonNullable<NonNullable<DiagnosticResults["seo"]>["rankings"]>[number];
export type FichaGoogle = NonNullable<DiagnosticResults["ficha_google"]>;
export type RedSocial = NonNullable<DiagnosticResults["redes"]>[number];
export type CanalPauta = NonNullable<DiagnosticResults["google_ads"]>;
export type Fuente = NonNullable<DiagnosticResults["investigacion"]>["fuentes"][number];
export type NumeroDestacado = DiagnosticResults["activos"][number];
export type PasoRecorrido = DiagnosticResults["recorrido"][number];
export type PasoPlan = DiagnosticResults["plan"][number];
export type LecturaInforme = DiagnosticResults["lecturas"][number];

/** Devuelve null en vez de tirar: un results viejo o corrupto degrada a la
 *  pantalla sobria de error, no a un 500 en la cara del cliente. */
export function parseResults(raw: unknown): DiagnosticResults | null {
  const validado = diagnosticResults.safeParse(raw);
  return validado.success ? validado.data : null;
}

/** Estados del diagnóstico que muestran informe. El resto tiene su pantalla. */
export function esInformeVisible(status: string): boolean {
  return status === "preliminary" || status === "sent";
}

export type Nivel = {
  id: "inicial" | "en_desarrollo" | "solido";
  label: string;
  /** Clases de la píldora, sobre fondo claro. */
  clase: string;
  /** Variante para la píldora sobre el hero oscuro. */
  claseOscura: string;
};

/** Los cortes salen de AGENTS.md: 0-39 inicial, 40-64 en desarrollo, 65+ sólido. */
export function nivelDeScore(score: number): Nivel {
  if (score < 40) {
    return {
      id: "inicial",
      label: "Inicial",
      clase: "bg-warnbg text-warn",
      claseOscura: "bg-[rgba(224,73,47,.22)] text-[#ff9d92]",
    };
  }
  if (score < 65) {
    return {
      id: "en_desarrollo",
      label: "En desarrollo",
      clase: "bg-midbg text-mid",
      claseOscura: "bg-[rgba(181,116,0,.28)] text-[#f5c979]",
    };
  }
  return {
    id: "solido",
    label: "Sólido",
    clase: "bg-okbg text-ok",
    claseOscura: "bg-[rgba(31,157,99,.24)] text-[#71dfa9]",
  };
}

/** Un Record y no un switch: si el esquema suma un estado, esto no compila. */
export const ETIQUETA_ESTADO: Record<EstadoCanal, { label: string; clase: string }> = {
  activo: { label: "Activo", clase: "bg-okbg text-ok" },
  parcial: { label: "Parcial", clase: "bg-midbg text-mid" },
  ausente: { label: "Ausente", clase: "bg-bg text-tinta" },
  fallas_criticas: { label: "Fallas críticas", clase: "bg-warnbg text-warn" },
  a_validar: { label: "A validar", clase: "bg-infobg text-info" },
};

/** Fecha completa para la portada del informe ("11 de septiembre de 2026"). */
export function fechaLarga(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/** Fecha del informe, en el formato del mockup ("Julio 2026"). */
export function mesYAnio(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const texto = fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
