import { z } from "zod";

/** Esquema de lo que devuelve Claude. Es el contrato: si la respuesta no
 *  valida contra esto, no se guarda.
 *
 *  La forma sigue la auditoría de referencia (docs/ejemplo-auditoria-audifarm.pdf),
 *  que NO se organiza en pilares sino en canales, y que arranca por lo que la
 *  empresa YA tiene antes de decir qué le falta. Un solo pilar: Arquitectura
 *  digital. Los canales que no podemos verificar con código (posiciones en
 *  Google, Google Ads, Meta Ads, redes, ficha de Google, competencia) no
 *  aparecen acá: se omiten hasta poder mirarlos de verdad, en vez de ocupar
 *  lugar con un "a validar". */

export const estadoCanal = z.enum([
  "activo",
  "parcial",
  "ausente",
  "fallas_criticas",
  /** Reservado para un solo caso: el sitio no se pudo leer, así que el canal
   *  no se pudo mirar. NO es "no lo analizamos en esta versión" —eso se omite—
   *  ni es ausencia: decir "ausente" cuando no pudimos verificar sería la
   *  acusación falsa que las reglas duras prohíben. */
  "a_validar",
]);

const check = z.object({
  tipo: z.enum(["error", "alerta", "ok"]),
  titulo: z.string(),
  detalle: z.string(),
});

const canal = z.object({
  /** 1 a 5, la escala de la auditoría: cinco = profesional y sostenido,
   *  uno = no existe o está roto. Alimenta el score y los puntos del resumen. */
  madurez: z.number().int().min(1).max(5),
  estado: estadoCanal,
  insight: z.string(),
  checks: z.array(check).max(6),
});

/** Un dato duro con su etiqueta: el "64.800 / seguidores en Instagram" de la
 *  auditoría. `dato` es lo que va grande, así que tiene que ser corto. */
const numeroDestacado = z.object({
  dato: z.string().max(24),
  etiqueta: z.string(),
});

export const analysisOutput = z.object({
  /** Portada: la tesis en dos golpes, como "Google ya te manda la consulta. /
   *  El problema es dónde cae." */
  tesis: z.object({
    titular: z.string(),
    bajada: z.string(),
  }),

  resumen: z.string(),

  /** "Lo que ya tienen": se abre por lo que existe, no por lo que falta. Puede
   *  venir vacío —un sitio roto no tiene activos que mostrar— y en ese caso la
   *  sección no se dibuja. Nunca se rellena para que quede lindo. */
  activos: z.array(numeroDestacado).max(6),

  /** "El recorrido": los pasos del comprador hasta que se va. Cada paso tiene
   *  que apoyarse en un fact; lo que no sabemos (si llega por Google, con qué
   *  búsqueda) no se narra. */
  recorrido: z.array(
    z.object({
      paso: z.string().max(20),
      detalle: z.string(),
    }),
  ).min(3).max(4),

  canales: z.object({
    sitio: canal,
    contacto: canal,
    /** El orden del sitio: cómo lo piensa la empresa vs. cómo busca el
     *  comprador. Se llama "orden" y no "arquitectura" para no chocar con el
     *  nombre del pilar. */
    orden: canal,
    busqueda: canal,
    /** Incluye la protección del correo (DMARC), como en la auditoría. */
    medicion: canal,
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

  /** El Método Qualita en 6 pasos. Va gateado detrás del CTA. */
  plan: z
    .array(
      z.object({
        titulo: z.string(),
        detalle: z.string(),
      }),
    )
    .min(4)
    .max(6),

  /** "En números": el titular de cierre. Los números de esa lámina los calcula
   *  el código desde los facts (lib/diagnostico/hechos.ts), así que ya no se le
   *  piden al modelo (analysis-1.3.0). `numeros` sigue aceptándose para que los
   *  informes viejos y el mock parseen; no se muestra. */
  cierre: z.object({
    titular: z.string(),
    numeros: z.array(numeroDestacado).max(6).optional().default([]),
  }),
});

export type AnalysisOutput = z.infer<typeof analysisOutput>;
export type Canal = z.infer<typeof canal>;

/** Las claves de canal en el orden en que se muestran, con su rótulo. El orden
 *  es el del recorrido: llega al sitio, busca cómo contactar, el sitio está (o
 *  no) ordenado, Google lo encuentra (o no), y nada de eso se mide. */
export const CANALES = [
  ["sitio", "Sitio web"],
  ["contacto", "Vías de contacto"],
  ["orden", "Cómo está ordenado el sitio"],
  ["busqueda", "Qué ve Google"],
  ["medicion", "Medición"],
] as const;

export type ClaveCanal = (typeof CANALES)[number][0];
