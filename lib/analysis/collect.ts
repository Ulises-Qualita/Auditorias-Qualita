import "server-only";

import { fetchSite, type FetchSiteResult } from "./collectors/fetchSite";
import { parseSeo, type SeoFacts } from "./collectors/parseSeo";
import { detectTracking, sumarGtm, type TrackingFacts } from "./collectors/detectTracking";
import { inspectGtm } from "./collectors/inspectGtm";
import { detectTech, type TechFacts } from "./collectors/detectTech";
import { detectContacto, type ContactoFacts } from "./collectors/detectContacto";
import { checkDmarc, normalizarDominio, type DmarcFacts } from "./collectors/checkDmarc";
import { pageSpeed, sinMedicion, type PageSpeedFacts } from "./collectors/pageSpeed";

/** Recolección determinista de hechos del sitio.
 *
 *  Este módulo NO llama a Claude ni interpreta nada: junta lo verificable con
 *  código y deja constancia de lo que no pudo verificar. La interpretación es
 *  otra fase, y consume esta salida como su base de hechos.
 *
 *  Runtime Node obligatorio (checkDmarc usa node:dns). El route handler o la
 *  server action que lo invoque no puede correr en edge. */

/** Versión de la recolección. Subirla cuando cambie QUÉ se recolecta o CÓMO
 *  se decide un campo, para que `method_version` en la DB siga siendo honesto. */
/** 1.4.0: PageSpeed activo (timeout 45 s + reintento) y datos de visitantes
 *  reales de CrUX en `pageSpeed.crux`.
 *  1.5.0: PageSpeed con las 4 categorías de Lighthouse (`puntajes`) y las
 *  auditorías que fallan (`mejoras`). */
export const COLLECT_VERSION = "collect-1.5.0";

/** Lo mínimo que necesita el recolector. Coincide con `companies`. */
export type CompanyInput = {
  name?: string | null;
  website?: string | null;
};

export type SiteFacts = {
  collectVersion: string;
  collectedAt: string;
  /** La URL tal como la cargó la empresa. null si no informó sitio. */
  inputUrl: string | null;
  /** La URL que efectivamente respondió, después de redirects. */
  finalUrl: string | null;
  domain: string | null;

  /** Metadatos de la descarga: status, redirect, tiempo de red. */
  fetch: FetchSiteResult;

  /** null cuando no hubo HTML que analizar. Nunca un objeto con ceros. */
  seo: SeoFacts | null;
  tracking: TrackingFacts | null;
  tech: TechFacts | null;
  /** Vías de contacto de la HOME (no de todo el sitio: solo bajamos esa). */
  contacto: ContactoFacts | null;
  dmarc: DmarcFacts | null;
  pageSpeed: PageSpeedFacts;

  /** Todo lo que no se pudo verificar, en texto legible. Va derecho al
   *  informe como "a validar": es la garantía anti-invención. */
  warnings: string[];
};

export type CollectOptions = {
  /** Medición de PageSpeed ya hecha. La función de Inngest la corre en su
   *  propio step (tarda ~50 s) y la pasa acá; sin ella, se mide ahora. */
  pageSpeed?: PageSpeedFacts;
};

export async function collect(
  company: CompanyInput,
  opciones: CollectOptions = {},
): Promise<SiteFacts> {
  const warnings: string[] = [];
  const collectedAt = new Date().toISOString();
  const inputUrl = normalizarEntrada(company.website);

  if (!inputUrl) {
    const informado = company.website?.trim();
    const motivo = informado
      ? `El sitio informado ("${informado}") no es una URL analizable.`
      : "La empresa no informó sitio web: no se pudo analizar infraestructura digital.";
    warnings.push(motivo);
    return {
      collectVersion: COLLECT_VERSION,
      collectedAt,
      inputUrl: null,
      finalUrl: null,
      domain: null,
      fetch: {
        ok: false,
        finalUrl: null,
        redirected: false,
        status: null,
        html: null,
        contentType: null,
        elapsedMs: null,
        error: motivo,
      },
      seo: null,
      tracking: null,
      tech: null,
      contacto: null,
      dmarc: null,
      pageSpeed: sinMedicion("Sin sitio web para medir"),
      warnings,
    };
  }

  const dominioEntrada = normalizarDominio(inputUrl);

  // El DMARC y PageSpeed no dependen del HTML, así que van en paralelo con
  // la descarga. Ninguna de las tres rechaza: cada una devuelve su fallo.
  const [resultadoFetch, dmarcEntrada, velocidad] = await Promise.all([
    fetchSite(inputUrl),
    dominioEntrada ? checkDmarc(dominioEntrada) : Promise.resolve(null),
    opciones.pageSpeed ?? pageSpeed(inputUrl),
  ]);

  const finalUrl = resultadoFetch.finalUrl ?? inputUrl;
  const domain = normalizarDominio(finalUrl) ?? dominioEntrada;

  // Si el sitio redirigió a otro dominio, el DMARC que importa es el del
  // dominio final; volvemos a consultar en vez de reportar el equivocado.
  let dmarc = dmarcEntrada;
  if (domain && dmarcEntrada && domain !== dmarcEntrada.domain) {
    dmarc = await checkDmarc(domain);
  }

  let seo: SeoFacts | null = null;
  let tracking: TrackingFacts | null = null;
  let tech: TechFacts | null = null;
  let contacto: ContactoFacts | null = null;

  if (resultadoFetch.ok && resultadoFetch.html) {
    const html = resultadoFetch.html;
    seo = ejecutar(() => parseSeo(html, finalUrl), "SEO on-page", warnings);
    tracking = ejecutar(() => detectTracking(html), "medición", warnings);
    tech = ejecutar(() => detectTech(html), "tecnología del sitio", warnings);
    contacto = ejecutar(() => detectContacto(html), "vías de contacto", warnings);
  } else {
    warnings.push(
      `No se pudo analizar el sitio ${inputUrl}: ${resultadoFetch.error ?? "motivo desconocido"}. ` +
        "Todo lo relativo a sitio, vías de contacto, SEO on-page y medición queda a validar.",
    );
  }

  // Lo que carga Tag Manager no está en el HTML: se lee el contenedor público.
  if (tracking?.gtm) {
    const contenedores = await inspectGtm(tracking.ids.filter((id) => id.startsWith("GTM-")));
    tracking = sumarGtm(tracking, contenedores);
    if (contenedores.some((c) => !c.leido)) {
      warnings.push(
        "Tag Manager: no se pudo leer el contenedor, así que lo que carga adentro (analítica, píxel, conversiones) queda a validar.",
      );
    }
  }

  agregarWarningsDmarc(dmarc, domain, warnings);
  agregarWarningsContacto(contacto, warnings);

  if (!velocidad.disponible && velocidad.motivo) {
    // Los warnings se muestran al cliente en el informe ("a validar"), así que
    // el motivo crudo —que puede nombrar una env var nuestra— se queda en
    // `pageSpeed.motivo` para la consola interna y acá va la versión legible.
    warnings.push("Velocidad de carga del sitio: no se pudo medir en esta corrida.");
  }

  if (seo && seo.urlsInternasTotal === 0 && resultadoFetch.ok) {
    warnings.push(
      "No se encontraron links internos en la home: la arquitectura del sitio no pudo evaluarse desde el HTML inicial.",
    );
  }

  if (tracking && !tracking.algunTagPresente) {
    // Ojo con el matiz: no vimos tags, no es lo mismo que no tenerlos.
    warnings.push(
      "No se detectaron etiquetas de medición en el HTML inicial. Podrían cargarse por JS: confirmar con accesos de solo lectura.",
    );
  }

  return {
    collectVersion: COLLECT_VERSION,
    collectedAt,
    inputUrl,
    finalUrl: resultadoFetch.finalUrl,
    domain,
    fetch: resultadoFetch,
    seo,
    tracking,
    tech,
    contacto,
    dmarc,
    pageSpeed: velocidad,
    warnings,
  };
}

/** Cinturón de seguridad: ningún recolector debería tirar (todos tienen su
 *  try/catch), pero si uno lo hace, se degrada a null + warning y el resto
 *  del diagnóstico sigue. */
function ejecutar<T>(fn: () => T, etiqueta: string, warnings: string[]): T | null {
  try {
    return fn();
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error desconocido";
    warnings.push(`No se pudo analizar ${etiqueta} (${detalle}). Queda a validar.`);
    return null;
  }
}

function agregarWarningsDmarc(
  dmarc: DmarcFacts | null,
  domain: string | null,
  warnings: string[],
): void {
  if (!dmarc) {
    // Solo pasa si no pudimos derivar un dominio consultable de la URL.
    warnings.push(
      `No se pudo derivar un dominio consultable de ${domain ?? "la URL informada"}: DMARC queda a validar.`,
    );
    return;
  }
  if (dmarc.exists === null) {
    warnings.push(
      `DMARC de ${dmarc.domain} no verificado: ${dmarc.error ?? "la consulta DNS falló"}. Queda a validar.`,
    );
  }
}

const NOMBRE_VIA: Record<keyof ContactoFacts["estados"], string> = {
  telefono: "teléfono para tocar",
  mail: "mail publicado",
  whatsapp: "WhatsApp",
  formulario: "formulario",
};

/** Las vías de contacto se tratan como el tracking: lo que no vimos en el HTML
 *  inicial no es ausencia. El motivo técnico crudo queda en `contacto.motivo`
 *  para la consola; acá va la versión legible, que llega al informe. */
function agregarWarningsContacto(contacto: ContactoFacts | null, warnings: string[]): void {
  // null ya tiene su warning (el fetch falló o el recolector se cayó).
  if (!contacto) return;

  if (contacto.estado === "no_verificable") {
    warnings.push(
      "Vías de contacto: no se pudieron verificar en la home (el contenido se arma con JavaScript). A confirmar.",
    );
    return;
  }
  if (contacto.estado === "no_detectado_html_inicial") {
    warnings.push(
      "Vías de contacto: no detectadas en el HTML inicial de la home; pueden cargar por JavaScript. A confirmar.",
    );
    return;
  }

  const faltantes = (Object.keys(contacto.estados) as Array<keyof ContactoFacts["estados"]>)
    .filter((via) => contacto.estados[via] !== "detectado")
    .map((via) => NOMBRE_VIA[via]);
  if (faltantes.length === 0) return;

  const lista =
    faltantes.length === 1
      ? faltantes[0]
      : `${faltantes.slice(0, -1).join(", ")} y ${faltantes[faltantes.length - 1]}`;
  const plural = faltantes.length > 1;
  warnings.push(
    `${lista.charAt(0).toUpperCase()}${lista.slice(1)}: no ${plural ? "detectados" : "detectado"} ` +
      `en el HTML inicial de la home; ${plural ? "pueden" : "puede"} cargar por JavaScript. A confirmar.`,
  );
}

/** Acepta lo que haya cargado la empresa y lo convierte en URL absoluta.
 *  Devuelve null si no hay nada usable; nunca inventa un dominio. */
export function normalizarEntrada(website: string | null | undefined): string | null {
  const texto = website?.trim();
  if (!texto) return null;

  const conEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;
  try {
    const url = new URL(conEsquema);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
