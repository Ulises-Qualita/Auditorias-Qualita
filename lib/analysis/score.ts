import type { AnalysisLectura, AnalysisOutput } from "./schema";

/** Scoring determinista: lo calcula el código, no Claude. Claude aporta la
 *  madurez 1-5 de los canales; el peso y la escala son nuestros y son estables.
 *
 *  Un solo pilar (Arquitectura digital), así que el score general ES el del
 *  pilar. `score_marca` queda en null: la columna sigue en la base para no
 *  perder informes viejos, pero el pilar Marca no se evalúa ni se muestra.
 *
 *  Desde analysis-2.0.0 el score sale de los SEIS canales del informe de
 *  referencia (docs/auditoria-ejemplo.html):
 *  - Sitio web: el promedio de los cuatro canales del sitio que puntúa la
 *    rúbrica con los facts (sitio, contacto, orden, busqueda).
 *  - Medición: el canal `medicion` de la rúbrica, tal cual.
 *  - Google orgánico, Redes + ficha, Google Ads y Meta Ads: los puntúa el
 *    modelo con lo que devolvió la búsqueda. Un canal que no se pudo mirar
 *    (madurez null) no entra al promedio: lo que no verificamos no baja ni
 *    sube la nota.
 *  Sin ningún canal externo puntuado —mock, búsqueda apagada, informe viejo—
 *  el score es el de antes, con los cinco canales del sitio. */

/** Pesos de los cinco canales del sitio, para cuando no hay canales externos.
 *  Suman 1. El orden refleja qué cuesta más plata cuando falla: de nada sirve
 *  aparecer en Google si cuando llegan no hay dónde dejar un dato. */
const PESOS_SITIO = {
  contacto: 0.3,
  sitio: 0.25,
  medicion: 0.2,
  busqueda: 0.15,
  orden: 0.1,
} as const;

/** Los seis canales, en el orden de la lámina "Score por canal" cuando
 *  empatan en madurez, con su rótulo y su peso. Suman 1: el sitio pesa más
 *  porque ahí aterriza todo; la medición después, porque sin ella nada de lo
 *  demás se puede corregir.
 *
 *  analysis-2.1.0: Sitio web pasó de 30% a 45% (orgánico 20→15, redes 10→8,
 *  cada Ads 10→6). Es lo que más controla la empresa y lo que se mide con
 *  facts, no con búsquedas; con 30% los canales externos lo diluían. */
export const CANALES_SCORE = [
  ["google_organico", "Google orgánico", 0.15],
  ["redes_ficha", "Redes + ficha", 0.08],
  ["sitio", "Sitio web", 0.45],
  ["google_ads", "Google Ads", 0.06],
  ["meta_ads", "Meta Ads", 0.06],
  ["medicion", "Medición", 0.2],
] as const;

export type ClaveCanalScore = (typeof CANALES_SCORE)[number][0];

export type CanalPuntuado = {
  clave: ClaveCanalScore;
  rotulo: string;
  /** null = no se pudo mirar en esta corrida. */
  madurez: number | null;
  detalle: string | null;
};

type ConCanales = Pick<AnalysisLectura, "canales" | "score_canales">;

/** La madurez de "Sitio web" en la escala del informe: el promedio de los
 *  cuatro canales del sitio que puntúa la rúbrica. */
export function madurezSitioWeb(canales: AnalysisOutput["canales"]): number {
  const { sitio, contacto, orden, busqueda } = canales;
  return Math.round((sitio.madurez + contacto.madurez + orden.madurez + busqueda.madurez) / 4);
}

/** Los seis canales con su madurez, en el orden canónico. Lo usan el score y
 *  la lámina del informe, para que los dos digan lo mismo. */
export function canalesPuntuados(out: ConCanales): CanalPuntuado[] {
  const externos = out.score_canales;

  return CANALES_SCORE.map(([clave, rotulo]) => {
    if (clave === "sitio") {
      return { clave, rotulo, madurez: madurezSitioWeb(out.canales), detalle: externos?.sitio.detalle ?? null };
    }
    if (clave === "medicion") {
      return {
        clave,
        rotulo,
        madurez: out.canales.medicion.madurez,
        detalle: externos?.medicion.detalle ?? null,
      };
    }
    const canal = externos?.[clave];
    return { clave, rotulo, madurez: canal?.madurez ?? null, detalle: canal?.detalle ?? null };
  });
}

/** De madurez promedio (1-5) a puntaje (0-100).
 *
 *  analysis-2.1.0: 1 → 30 y 5 → 100, lineal (2 → 48, 3 → 65, 4 → 83). Antes
 *  era `promedio / 5 × 100`, con 1 → 20: como las madureces reales viven
 *  entre 2,5 y 3,5 —la rúbrica tiene piso 2 en lo no verificable y el 5 es
 *  exigente—, casi todo caía en 50-65 y una empresa floja quedaba igual que
 *  una del montón. Los cortes de nivel (40 / 65) no se tocaron: un "3 en
 *  todo" queda justo en el borde de Sólido. */
const PUNTAJE_MADUREZ_1 = 30;

export function aPuntaje(promedio1a5: number): number {
  return Math.round(PUNTAJE_MADUREZ_1 + ((promedio1a5 - 1) / 4) * (100 - PUNTAJE_MADUREZ_1));
}

export function computeScores(out: ConCanales) {
  const c = out.canales;
  const seis = canalesPuntuados(out);
  const hayExternos = seis.some(
    (canal) => canal.clave !== "sitio" && canal.clave !== "medicion" && canal.madurez !== null,
  );

  let promedio1a5: number;
  if (hayExternos) {
    // Se renormaliza sobre los canales que se pudieron mirar.
    let suma = 0;
    let pesos = 0;
    for (const [clave, , peso] of CANALES_SCORE) {
      const madurez = seis.find((canal) => canal.clave === clave)?.madurez;
      if (madurez == null) continue;
      suma += madurez * peso;
      pesos += peso;
    }
    promedio1a5 = suma / pesos;
  } else {
    promedio1a5 =
      c.contacto.madurez * PESOS_SITIO.contacto +
      c.sitio.madurez * PESOS_SITIO.sitio +
      c.medicion.madurez * PESOS_SITIO.medicion +
      c.busqueda.madurez * PESOS_SITIO.busqueda +
      c.orden.madurez * PESOS_SITIO.orden;
  }

  const score_bruto = aPuntaje(promedio1a5);

  // Techo por canal roto. Un promedio ponderado diluye el desastre: un sitio
  // impecable con CERO vías de contacto daba 66 y salía "Sólido", cuando lo
  // único que importa es que la consulta no tiene dónde caer. Si algún canal
  // DEL SITIO está en 1, el diagnóstico no puede pasar de "En desarrollo".
  // Los externos no activan el techo: no pautar en Meta es una decisión, no
  // un sitio roto.
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
