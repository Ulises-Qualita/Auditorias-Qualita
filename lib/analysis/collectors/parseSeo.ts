import "server-only";
import * as cheerio from "cheerio";

/** Chequeos on-page verificables sobre el HTML. Todo lo que sale de acá es
 *  observable en el fuente: nada inferido, nada estimado. */

export type UrlInterna = {
  href: string;
  /** El último segmento del path, que es lo que clasificamos. */
  slug: string;
  descriptiva: boolean;
  /** Por qué la marcamos como críptica. null si es descriptiva. */
  motivo: string | null;
};

export type SeoFacts = {
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaDescriptionLength: number | null;
  h1Count: number;
  /** Los H1 encontrados, recortados. Sirven para juzgar si dicen algo. */
  h1Texts: string[];
  htmlLang: string | null;
  canonical: string | null;
  /** Links internos únicos analizados (tope de 60 para no inflar el payload). */
  urlsInternas: UrlInterna[];
  urlsInternasTotal: number;
  urlsCripticas: number;
};

/** Extensiones y patrones que delatan una URL que no le dice nada ni al
 *  comprador ni a Google. */
const PATRONES_CRIPTICOS: Array<{ test: RegExp; motivo: string }> = [
  { test: /^\d+$/, motivo: "es solo un número" },
  { test: /^(p|page|id|item|post|node|cat)[-_]?\d+$/i, motivo: "es un id interno" },
  { test: /^[0-9a-f]{8,}$/i, motivo: "es un hash" },
  { test: /\.(php|aspx?|jsp|cfm)$/i, motivo: "expone la tecnología, no el contenido" },
  { test: /^(index|default|home)\.\w+$/i, motivo: "es un archivo genérico" },
];

export function parseSeo(html: string, baseUrl: string): SeoFacts {
  const vacio: SeoFacts = {
    title: null,
    titleLength: null,
    metaDescription: null,
    metaDescriptionLength: null,
    h1Count: 0,
    h1Texts: [],
    htmlLang: null,
    canonical: null,
    urlsInternas: [],
    urlsInternasTotal: 0,
    urlsCripticas: 0,
  };

  try {
    const $ = cheerio.load(html);

    const title = limpiar($("head title").first().text());
    const metaDescription = limpiar(
      $('meta[name="description"]').first().attr("content") ?? "",
    );
    const htmlLang = limpiar($("html").attr("lang") ?? "");
    const canonical = limpiar($('link[rel="canonical"]').first().attr("href") ?? "");

    const h1Texts = $("h1")
      .map((_, el) => limpiar($(el).text()))
      .get()
      .filter((texto): texto is string => texto !== null)
      .map((texto) => (texto.length > 160 ? `${texto.slice(0, 160)}…` : texto));

    const { urls, total, cripticas } = analizarUrlsInternas($, baseUrl);

    return {
      title,
      titleLength: title?.length ?? null,
      metaDescription,
      metaDescriptionLength: metaDescription?.length ?? null,
      h1Count: $("h1").length,
      h1Texts,
      htmlLang,
      canonical,
      urlsInternas: urls,
      urlsInternasTotal: total,
      urlsCripticas: cripticas,
    };
  } catch {
    // HTML tan roto que cheerio no lo carga. Preferimos "sin datos" a inventar.
    return vacio;
  }
}

function analizarUrlsInternas(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): { urls: UrlInterna[]; total: number; cripticas: number } {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return { urls: [], total: 0, cripticas: 0 };
  }

  const vistas = new Set<string>();
  const urls: UrlInterna[] = [];
  let cripticas = 0;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let resuelta: URL;
    try {
      resuelta = new URL(href, base);
    } catch {
      return;
    }
    if (resuelta.protocol !== "http:" && resuelta.protocol !== "https:") return;
    // Solo links internos: el mismo host, sin www para comparar.
    if (sinWww(resuelta.hostname) !== sinWww(base.hostname)) return;

    const clave = resuelta.pathname.replace(/\/+$/, "") || "/";
    if (clave === "/" || vistas.has(clave)) return;
    vistas.add(clave);

    const evaluada = clasificarSlug(clave, resuelta);
    if (!evaluada.descriptiva) cripticas += 1;
    if (urls.length < 60) urls.push(evaluada);
  });

  return { urls, total: vistas.size, cripticas };
}

function clasificarSlug(pathname: string, url: URL): UrlInterna {
  const segmentos = pathname.split("/").filter(Boolean);
  const slug = segmentos[segmentos.length - 1] ?? "";
  const href = `${url.pathname}${url.search}`;

  // Una query con id es críptica aunque el path se vea bien.
  if (/[?&](p|id|page_id|cat|product_id)=\d+/i.test(url.search)) {
    return { href, slug, descriptiva: false, motivo: "usa un id en la query" };
  }

  for (const { test, motivo } of PATRONES_CRIPTICOS) {
    if (test.test(slug)) return { href, slug, descriptiva: false, motivo };
  }

  // Descriptiva = tiene palabras reales, no una sola letra ni puro guion.
  const letras = slug.replace(/[^a-záéíóúüñ]/gi, "").length;
  if (letras < 3) {
    return { href, slug, descriptiva: false, motivo: "no contiene palabras" };
  }

  return { href, slug, descriptiva: true, motivo: null };
}

function sinWww(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function limpiar(valor: string): string | null {
  const texto = valor.replace(/\s+/g, " ").trim();
  return texto.length > 0 ? texto : null;
}
