import type { AnalysisOutput } from "./schema";

/** Scoring determinista: lo calcula el código, no Claude. Claude solo aporta
 *  la madurez 1-5 por canal; el peso y la escala son nuestros y son estables.
 *
 *  Google Ads y Meta Ads NO promedian en v1: van a_validar, y meter un canal
 *  sin medir en el promedio sería inventar. */

const PESOS = { sitio: 0.40, medicion: 0.35, seo: 0.25 };

export function computeScores(out: AnalysisOutput) {
  const m = out.infra;
  const infra1a5 =
    m.sitio.madurez * PESOS.sitio +
    m.medicion.madurez * PESOS.medicion +
    m.seo.madurez * PESOS.seo;
  const score_infra = Math.round((infra1a5 / 5) * 100);
  const score_marca = null; // v1: Marca a validar
  const score_general = score_infra; // v1: sin Marca, general = infra
  const nivel =
    score_general < 40 ? "inicial" : score_general < 65 ? "en_desarrollo" : "solido";
  return { score_infra, score_marca, score_general, nivel };
}
