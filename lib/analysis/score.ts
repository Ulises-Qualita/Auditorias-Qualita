import type { AnalysisOutput } from "./schema";

/** Scoring determinista: lo calcula el código, no Claude. Claude solo aporta
 *  la madurez 1-5 por canal; el peso y la escala son nuestros y son estables.
 *
 *  Un solo pilar (Arquitectura digital), así que el score general ES el del
 *  pilar. `score_marca` queda en null: la columna sigue en la base para no
 *  perder informes viejos, pero el pilar Marca no se evalúa ni se muestra. */

/** Suman 1. El orden refleja qué cuesta más plata cuando falla: de nada sirve
 *  aparecer en Google si cuando llegan no hay dónde dejar un dato. */
const PESOS = {
  contacto: 0.3,
  sitio: 0.25,
  medicion: 0.2,
  busqueda: 0.15,
  orden: 0.1,
} as const;

export function computeScores(out: AnalysisOutput) {
  const c = out.canales;
  const promedio1a5 =
    c.contacto.madurez * PESOS.contacto +
    c.sitio.madurez * PESOS.sitio +
    c.medicion.madurez * PESOS.medicion +
    c.busqueda.madurez * PESOS.busqueda +
    c.orden.madurez * PESOS.orden;

  const score_bruto = Math.round((promedio1a5 / 5) * 100);

  // Techo por canal roto. Un promedio ponderado diluye el desastre: un sitio
  // impecable con CERO vías de contacto daba 66 y salía "Sólido", cuando lo
  // único que importa es que la consulta no tiene dónde caer. Si algún canal
  // está en 1, el diagnóstico no puede pasar de "En desarrollo".
  const hayCanalRoto = Object.values(c).some((canal) => canal.madurez === 1);
  const score_general = hayCanalRoto ? Math.min(score_bruto, 64) : score_bruto;
  // El pilar es el diagnóstico entero: mismo número, dos nombres, para que la
  // consola y los informes viejos sigan leyendo la columna que ya usaban.
  const score_infra = score_general;
  const score_marca = null;

  const nivel =
    score_general < 40 ? "inicial" : score_general < 65 ? "en_desarrollo" : "solido";

  return { score_infra, score_marca, score_general, nivel };
}
