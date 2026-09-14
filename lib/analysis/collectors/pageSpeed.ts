import "server-only";

/** PageSpeed Insights. Sin `PAGESPEED_API_KEY` no llamamos y devolvemos
 *  `disponible: false`. No hay valores por defecto ni estimados — si no
 *  medimos, no hay número.
 *
 *  La key es una "Clave de API" de Google Cloud restringida a la PageSpeed
 *  Insights API (no el cliente OAuth del login), en PAGESPEED_API_KEY.
 *
 *  Pide las 4 categorías de Lighthouse (rendimiento, accesibilidad, prácticas
 *  recomendadas y SEO) en español, y de la respuesta (~650 KB) se queda solo
 *  con los puntajes, las métricas y las mejoras que fallan. */

export type PageSpeedFacts = {
  /** false = no corrimos la medición (sin key, o falló). */
  disponible: boolean;
  strategy: "mobile";
  /** Rendimiento 0-100. null si no medimos. Igual a `puntajes.rendimiento`;
   *  queda por compatibilidad con los informes y la rúbrica existentes. */
  performance: number | null;
  /** Los 4 puntajes de Lighthouse, 0-100. */
  puntajes: PuntajesPageSpeed | null;
  /** Métricas del análisis de laboratorio, en ms salvo CLS. */
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  speedIndexMs: number | null;
  /** Marca de tiempo de la medición, para poder citarla con fecha. */
  medidoEn: string | null;
  /** Experiencia de visitantes REALES (Chrome UX Report, últimos 28 días).
   *  null cuando el sitio no tiene tráfico suficiente para que Google publique
   *  datos: es lo normal en pymes, no un error. */
  crux: CruxFacts | null;
  /** Lo que Lighthouse marca para mejorar, ordenado por impacto dentro de
   *  cada categoría. Vacío si todo pasa. */
  mejoras: MejoraPageSpeed[];
  /** Motivo por el que no hay datos. null si los hay. */
  motivo: string | null;
};

export type CategoriaPageSpeed = "rendimiento" | "accesibilidad" | "practicas" | "seo";

export type PuntajesPageSpeed = Record<CategoriaPageSpeed, number | null>;

export type MejoraPageSpeed = {
  /** Id de la auditoría de Lighthouse (estable entre idiomas): con esto se
   *  traduce a lenguaje llano para el cliente. */
  id: string;
  categoria: CategoriaPageSpeed;
  /** Título de Lighthouse en español. Técnico: para la consola. */
  titulo: string;
  /** El dato que muestra Lighthouse ("Ahorro estimado de 7436 KiB"). */
  valor: string | null;
  /** 0-100. */
  puntaje: number | null;
  /** Ahorro estimado en KB, cuando Lighthouse lo informa. */
  ahorroKb: number | null;
  /** Orden relativo dentro de la categoría: ms ahorrables en rendimiento,
   *  peso de la auditoría en las demás. */
  impacto: number;
};

/** Categorías de Google para visitantes reales. */
export type CategoriaCrux = "FAST" | "AVERAGE" | "SLOW";

export type CruxFacts = {
  /** Calificación general de la experiencia de carga. */
  categoria: CategoriaCrux | null;
  /** true = no hay datos de esta URL y Google devolvió los del dominio entero. */
  deTodoElDominio: boolean;
  /** Percentil 75 de los visitantes reales. */
  lcpMs: number | null;
  lcpCategoria: CategoriaCrux | null;
  inpMs: number | null;
  inpCategoria: CategoriaCrux | null;
  /** Ya en su escala real (0.1 = umbral bueno), no la ×100 que manda la API. */
  cls: number | null;
  clsCategoria: CategoriaCrux | null;
};

/** Con las 4 categorías PSI tarda más: la primera medición completa llevó
 *  51 s, y con una sola categoría ya se habían visto 40 s y un cuelgue que al
 *  reintentar midió en 19. Por eso 90 s por intento y un reintento.
 *
 *  Corre en su propio step de Inngest (lib/inngest/functions.ts), así que
 *  estos 180 s de peor caso no le quitan tiempo a la llamada a Claude. */
const TIMEOUT_MS = 90_000;
const INTENTOS = 2;
const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
/** Tope por categoría: el informe muestra pocas y la consola no necesita 40. */
const MEJORAS_POR_CATEGORIA = 8;

const CATEGORIAS: Array<[CategoriaPageSpeed, string]> = [
  ["rendimiento", "performance"],
  ["accesibilidad", "accessibility"],
  ["practicas", "best-practices"],
  ["seo", "seo"],
];

const APAGADO: Omit<PageSpeedFacts, "motivo"> = {
  disponible: false,
  strategy: "mobile",
  performance: null,
  puntajes: null,
  fcpMs: null,
  lcpMs: null,
  cls: null,
  tbtMs: null,
  speedIndexMs: null,
  medidoEn: null,
  crux: null,
  mejoras: [],
};

/** Una medición que no se hizo, con su motivo. */
export function sinMedicion(motivo: string): PageSpeedFacts {
  return { ...APAGADO, motivo };
}

export async function pageSpeed(url: string): Promise<PageSpeedFacts> {
  const apiKey = process.env.PAGESPEED_API_KEY?.trim();
  if (!apiKey) {
    return { ...APAGADO, motivo: "PAGESPEED_API_KEY no está configurada" };
  }

  let ultimo: PageSpeedFacts = { ...APAGADO, motivo: "No se pudo consultar PageSpeed" };

  for (let intento = 1; intento <= INTENTOS; intento += 1) {
    const { facts, reintentable } = await medir(url, apiKey);
    if (facts.disponible || !reintentable) return facts;
    ultimo = facts;
  }

  return ultimo;
}

/** Un intento. `reintentable` separa lo que puede salir bien a la segunda
 *  (timeout, corte de red, error 5xx de Lighthouse) de lo que va a dar igual:
 *  cuota agotada (429), key inválida (400/403) o un sitio que Lighthouse no
 *  puede abrir. */
async function medir(
  url: string,
  apiKey: string,
): Promise<{ facts: PageSpeedFacts; reintentable: boolean }> {
  try {
    const consulta = new URL(ENDPOINT);
    consulta.searchParams.set("url", url);
    consulta.searchParams.set("strategy", "mobile"); // el tráfico real es móvil
    for (const [, categoriaApi] of CATEGORIAS) {
      consulta.searchParams.append("category", categoriaApi);
    }
    // Títulos de las auditorías en español, para la consola.
    consulta.searchParams.set("locale", "es");
    consulta.searchParams.set("key", apiKey);

    const respuesta = await fetch(consulta, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!respuesta.ok) {
      return {
        facts: { ...APAGADO, motivo: `PageSpeed respondió ${respuesta.status}` },
        reintentable: respuesta.status >= 500,
      };
    }

    const datos = (await respuesta.json()) as PsiRespuesta;
    const lighthouse = datos.lighthouseResult;
    if (!lighthouse) {
      return {
        facts: { ...APAGADO, motivo: "PageSpeed no devolvió resultados" },
        reintentable: true,
      };
    }

    const audits = lighthouse.audits ?? {};
    const puntajes = leerPuntajes(lighthouse);

    return {
      facts: {
        disponible: true,
        strategy: "mobile",
        performance: puntajes.rendimiento,
        puntajes,
        fcpMs: numeroDeAudit(audits["first-contentful-paint"]),
        lcpMs: numeroDeAudit(audits["largest-contentful-paint"]),
        cls: numeroDeAudit(audits["cumulative-layout-shift"]),
        tbtMs: numeroDeAudit(audits["total-blocking-time"]),
        speedIndexMs: numeroDeAudit(audits["speed-index"]),
        medidoEn: lighthouse.fetchTime ?? new Date().toISOString(),
        crux: leerCrux(datos.loadingExperience),
        mejoras: leerMejoras(lighthouse),
        motivo: null,
      },
      reintentable: false,
    };
  } catch (error) {
    const nombre = error instanceof Error ? error.name : "";
    return {
      facts: {
        ...APAGADO,
        motivo:
          nombre === "TimeoutError"
            ? "PageSpeed no respondió a tiempo"
            : "No se pudo consultar PageSpeed",
      },
      reintentable: true,
    };
  }
}

type PsiAudit = {
  title?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  metricSavings?: Record<string, number | undefined>;
  details?: { overallSavingsMs?: number; overallSavingsBytes?: number };
};
type PsiAuditRef = { id: string; weight?: number; group?: string };
type PsiCategoria = { score?: number | null; auditRefs?: PsiAuditRef[] };
type PsiMetricaCrux = { percentile?: number; category?: string };
type PsiLighthouse = {
  fetchTime?: string;
  categories?: Record<string, PsiCategoria | undefined>;
  audits?: Record<string, PsiAudit | undefined>;
};
type PsiRespuesta = {
  loadingExperience?: {
    overall_category?: string;
    origin_fallback?: boolean;
    metrics?: Record<string, PsiMetricaCrux | undefined>;
  };
  lighthouseResult?: PsiLighthouse;
};

function leerPuntajes(lighthouse: PsiLighthouse): PuntajesPageSpeed {
  const puntajes = {} as PuntajesPageSpeed;
  for (const [nuestra, api] of CATEGORIAS) {
    const score = lighthouse.categories?.[api]?.score;
    // PSI da el score 0-1; lo pasamos a 0-100 solo si vino.
    puntajes[nuestra] = typeof score === "number" ? Math.round(score * 100) : null;
  }
  return puntajes;
}

/** Modos de auditoría que no son un "pasa / no pasa" sobre el sitio. */
const MODOS_SIN_VEREDICTO = new Set(["notApplicable", "manual", "informative", "error"]);

/** Auditorías que Lighthouse lista pero no son accionables por sí mismas. */
const AUDITS_IGNORADAS = new Set([
  "network-dependency-tree-insight",
  "forced-reflow-insight",
  "inspector-issues",
  "valid-source-maps",
]);

/** Qué cuenta como mejora:
 *  - rendimiento: los grupos "insights" y "diagnostics" (las métricas son el
 *    síntoma, no lo que se toca), ordenados por los ms que se ahorrarían;
 *  - las otras tres: las auditorías con peso en el puntaje, ordenadas por peso.
 *  En todas, solo lo que no pasa (puntaje por debajo de 90). Una misma
 *  auditoría en dos categorías (el alt de las imágenes está en accesibilidad y
 *  en SEO) se cuenta una vez, en la primera. */
function leerMejoras(lighthouse: PsiLighthouse): MejoraPageSpeed[] {
  const audits = lighthouse.audits ?? {};
  const vistas = new Set<string>();
  const mejoras: MejoraPageSpeed[] = [];

  for (const [nuestra, api] of CATEGORIAS) {
    const refs = lighthouse.categories?.[api]?.auditRefs ?? [];
    const deCategoria: MejoraPageSpeed[] = [];

    for (const ref of refs) {
      if (vistas.has(ref.id) || AUDITS_IGNORADAS.has(ref.id)) continue;

      const audit = audits[ref.id];
      if (!audit || typeof audit.score !== "number" || audit.score >= 0.9) continue;
      if (audit.scoreDisplayMode && MODOS_SIN_VEREDICTO.has(audit.scoreDisplayMode)) continue;

      const esRendimiento = nuestra === "rendimiento";
      if (esRendimiento && ref.group !== "insights" && ref.group !== "diagnostics") continue;
      if (!esRendimiento && !(ref.weight && ref.weight > 0)) continue;

      vistas.add(ref.id);
      deCategoria.push({
        id: ref.id,
        categoria: nuestra,
        titulo: audit.title ?? ref.id,
        valor: audit.displayValue ?? null,
        puntaje: Math.round(audit.score * 100),
        ahorroKb: ahorroKb(audit),
        impacto: esRendimiento ? msAhorrables(audit) : (ref.weight ?? 0),
      });
    }

    deCategoria.sort((a, b) => b.impacto - a.impacto || (a.puntaje ?? 0) - (b.puntaje ?? 0));
    mejoras.push(...deCategoria.slice(0, MEJORAS_POR_CATEGORIA));
  }

  return mejoras;
}

function msAhorrables(audit: PsiAudit): number {
  const porMetrica = Object.values(audit.metricSavings ?? {}).reduce<number>(
    (suma, valor) => suma + (typeof valor === "number" ? valor : 0),
    0,
  );
  return Math.max(porMetrica, audit.details?.overallSavingsMs ?? 0);
}

/** Lighthouse informa el ahorro en bytes en algunas auditorías y solo en el
 *  texto ("Ahorro estimado de 7436 KiB", con punto de miles en español) en
 *  los insights nuevos. */
function ahorroKb(audit: PsiAudit): number | null {
  const bytes = audit.details?.overallSavingsBytes;
  if (typeof bytes === "number" && bytes > 0) return Math.round(bytes / 1024);

  const coincidencia = audit.displayValue?.match(/([\d.,]+)\s*KiB/i);
  if (!coincidencia) return null;
  const numero = Number(coincidencia[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : null;
}

/** Sin métricas no hay CrUX: Google manda `loadingExperience` igual, vacío,
 *  cuando el sitio no tiene tráfico suficiente. */
function leerCrux(experiencia: PsiRespuesta["loadingExperience"]): CruxFacts | null {
  const metricas = experiencia?.metrics;
  if (!metricas || Object.keys(metricas).length === 0) return null;

  const lcp = metricas.LARGEST_CONTENTFUL_PAINT_MS;
  const inp = metricas.INTERACTION_TO_NEXT_PAINT;
  const cls = metricas.CUMULATIVE_LAYOUT_SHIFT_SCORE;
  // La API manda el CLS multiplicado por 100 (10 = 0.10).
  const clsX100 = percentil(cls);

  return {
    categoria: categoria(experiencia?.overall_category),
    deTodoElDominio: experiencia?.origin_fallback === true,
    lcpMs: percentil(lcp),
    lcpCategoria: categoria(lcp?.category),
    inpMs: percentil(inp),
    inpCategoria: categoria(inp?.category),
    cls: clsX100 === null ? null : clsX100 / 100,
    clsCategoria: categoria(cls?.category),
  };
}

function percentil(metrica: PsiMetricaCrux | undefined): number | null {
  const valor = metrica?.percentile;
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function categoria(valor: string | undefined): CategoriaCrux | null {
  return valor === "FAST" || valor === "AVERAGE" || valor === "SLOW" ? valor : null;
}

function numeroDeAudit(audit: PsiAudit | undefined): number | null {
  const valor = audit?.numericValue;
  return typeof valor === "number" && Number.isFinite(valor)
    ? Math.round(valor * 1000) / 1000
    : null;
}
