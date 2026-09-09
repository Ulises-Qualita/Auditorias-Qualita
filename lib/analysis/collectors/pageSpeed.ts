import "server-only";

/** PageSpeed Insights. Hook listo pero apagado: sin `PAGESPEED_API_KEY` no
 *  llamamos y devolvemos `disponible: false`. No hay valores por defecto ni
 *  estimados — si no medimos, no hay número.
 *
 *  Para activarlo: sacar una key en Google Cloud (PageSpeed Insights API) y
 *  ponerla en `.env.local` como PAGESPEED_API_KEY. */

export type PageSpeedFacts = {
  /** false = no corrimos la medición (sin key, o falló). */
  disponible: boolean;
  strategy: "mobile";
  /** Performance 0-100. null si no medimos. */
  performance: number | null;
  /** Core Web Vitals del análisis de laboratorio, en ms salvo CLS. */
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  /** Marca de tiempo de la medición, para poder citarla con fecha. */
  medidoEn: string | null;
  /** Motivo por el que no hay datos. null si los hay. */
  motivo: string | null;
};

const TIMEOUT_MS = 30_000; // PSI es lento: mide el sitio de verdad
const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const APAGADO: Omit<PageSpeedFacts, "motivo"> = {
  disponible: false,
  strategy: "mobile",
  performance: null,
  lcpMs: null,
  cls: null,
  tbtMs: null,
  medidoEn: null,
};

export async function pageSpeed(url: string): Promise<PageSpeedFacts> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return { ...APAGADO, motivo: "PAGESPEED_API_KEY no está configurada" };
  }

  try {
    const consulta = new URL(ENDPOINT);
    consulta.searchParams.set("url", url);
    consulta.searchParams.set("strategy", "mobile"); // el tráfico real es móvil
    consulta.searchParams.set("category", "performance");
    consulta.searchParams.set("key", apiKey);

    const respuesta = await fetch(consulta, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!respuesta.ok) {
      return {
        ...APAGADO,
        motivo: `PageSpeed respondió ${respuesta.status}`,
      };
    }

    const datos = (await respuesta.json()) as PsiRespuesta;
    const lighthouse = datos.lighthouseResult;
    if (!lighthouse) {
      return { ...APAGADO, motivo: "PageSpeed no devolvió resultados" };
    }

    const puntaje = lighthouse.categories?.performance?.score;
    const audits = lighthouse.audits ?? {};

    return {
      disponible: true,
      strategy: "mobile",
      // PSI da el score 0-1; lo pasamos a 0-100 solo si vino.
      performance: typeof puntaje === "number" ? Math.round(puntaje * 100) : null,
      lcpMs: numeroDeAudit(audits["largest-contentful-paint"]),
      cls: numeroDeAudit(audits["cumulative-layout-shift"]),
      tbtMs: numeroDeAudit(audits["total-blocking-time"]),
      medidoEn: lighthouse.fetchTime ?? new Date().toISOString(),
      motivo: null,
    };
  } catch (error) {
    const nombre = error instanceof Error ? error.name : "";
    return {
      ...APAGADO,
      motivo:
        nombre === "TimeoutError"
          ? "PageSpeed no respondió a tiempo"
          : "No se pudo consultar PageSpeed",
    };
  }
}

type PsiAudit = { numericValue?: number };
type PsiRespuesta = {
  lighthouseResult?: {
    fetchTime?: string;
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, PsiAudit | undefined>;
  };
};

function numeroDeAudit(audit: PsiAudit | undefined): number | null {
  const valor = audit?.numericValue;
  return typeof valor === "number" && Number.isFinite(valor)
    ? Math.round(valor * 1000) / 1000
    : null;
}
