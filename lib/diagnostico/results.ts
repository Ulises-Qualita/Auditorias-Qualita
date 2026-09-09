import { z } from "zod";

import { analysisOutput, estadoCanal } from "@/lib/analysis/schema";

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

export const diagnosticResults = analysisOutput.extend({
  analysis_source: z.enum(["mock", "claude"]).optional(),
  a_validar: z.array(z.string()).optional().default([]),
  pilar_marca: z.object({ estado: z.literal("a_validar") }).optional(),
});

export type DiagnosticResults = z.infer<typeof diagnosticResults>;
export type EstadoCanal = z.infer<typeof estadoCanal>;
export type CanalInfra = DiagnosticResults["infra"]["sitio"];
export type CanalAValidar = DiagnosticResults["infra"]["google_ads"];
export type Check = CanalInfra["checks"][number];
export type Fuga = DiagnosticResults["fugas"][number];

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

/** Fecha del informe, en el formato del mockup ("Julio 2026"). */
export function mesYAnio(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const texto = fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
