import "server-only";

import type { GtmContenedor } from "./inspectGtm";

/** Detección de medición sobre el HTML servido.
 *
 *  LÍMITE IMPORTANTE, respetarlo al redactar hallazgos: esto ve solo el HTML
 *  inicial. Un tag cargado por GTM, por un script diferido o inyectado por
 *  JS no aparece acá. Por eso `true` significa "verificado presente", pero
 *  `false` significa "no visible en el HTML inicial" — NO "no tiene". Esa
 *  distinción es la diferencia entre un dato y una acusación falsa.
 *
 *  Lo cargado por GTM se suma después con sumarGtm(), leyendo el contenedor
 *  público: ahí `true` también es "verificado", con `viaGtm` diciendo de dónde. */

export type TrackingFacts = {
  ga4: boolean;
  gtm: boolean;
  metaPixel: boolean;
  googleAdsConversion: boolean;
  /** Analytics viejo: si aparece, es señal de medición desactualizada. */
  universalAnalyticsLegacy: boolean;
  /** Ids efectivamente encontrados (HTML + contenedores GTM). */
  ids: string[];
  /** true si hay algún tag detectado. */
  algunTagPresente: boolean;
  /** Qué se encontró DENTRO de Tag Manager. null = no se leyó ningún
   *  contenedor (no hay GTM, o no se pudo bajar). */
  viaGtm: { ga4: boolean; metaPixel: boolean; googleAdsConversion: boolean } | null;
  /** El detalle de cada contenedor, para la consola y el prompt. */
  contenedoresGtm: GtmContenedor[];
};

const VACIO: TrackingFacts = {
  ga4: false,
  gtm: false,
  metaPixel: false,
  googleAdsConversion: false,
  universalAnalyticsLegacy: false,
  ids: [],
  algunTagPresente: false,
  viaGtm: null,
  contenedoresGtm: [],
};

const ID_GA4 = /\bG-[A-Z0-9]{6,12}\b/g;
const ID_GTM = /\bGTM-[A-Z0-9]{4,10}\b/g;
const ID_ADS = /\bAW-\d{9,12}\b/g;
const ID_UA_LEGACY = /\bUA-\d{4,10}-\d{1,4}\b/g;

export function detectTracking(html: string): TrackingFacts {
  try {
    const ids = new Set<string>();

    const ga4Ids = html.match(ID_GA4) ?? [];
    const gtmIds = html.match(ID_GTM) ?? [];
    const adsIds = html.match(ID_ADS) ?? [];
    const uaIds = html.match(ID_UA_LEGACY) ?? [];
    for (const id of [...ga4Ids, ...gtmIds, ...adsIds, ...uaIds]) ids.add(id);

    // GA4: el id G- o el loader de gtag apuntando a un measurement id.
    const ga4 =
      ga4Ids.length > 0 ||
      /googletagmanager\.com\/gtag\/js\?id=G-/i.test(html);

    // GTM: el id GTM- o el loader/noscript del contenedor.
    const gtm =
      gtmIds.length > 0 ||
      /googletagmanager\.com\/(gtm\.js|ns\.html)/i.test(html);

    // Meta: la función fbq, el loader del pixel o el noscript de fallback.
    const metaPixel =
      /\bfbq\s*\(/.test(html) ||
      /connect\.facebook\.net\/[^"']*\/fbevents\.js/i.test(html) ||
      /facebook\.com\/tr\?id=\d+/i.test(html);

    // Google Ads: id AW-, el tag de conversión clásico o el remarketing.
    const googleAdsConversion =
      adsIds.length > 0 ||
      /googleadservices\.com\/pagead\/conversion/i.test(html) ||
      /gtag\s*\(\s*['"]event['"]\s*,\s*['"]conversion['"]/i.test(html);

    const universalAnalyticsLegacy =
      uaIds.length > 0 || /google-analytics\.com\/analytics\.js/i.test(html);

    return {
      ga4,
      gtm,
      metaPixel,
      googleAdsConversion,
      universalAnalyticsLegacy,
      ids: [...ids].sort(),
      algunTagPresente:
        ga4 || gtm || metaPixel || googleAdsConversion || universalAnalyticsLegacy,
      viaGtm: null,
      contenedoresGtm: [],
    };
  } catch {
    return { ...VACIO, ids: [] };
  }
}

/** Suma lo que cargan los contenedores de GTM a lo visto en el HTML.
 *
 *  Conversión de Ads por GTM = un tag de conversión (__awct). Un id AW- solo
 *  puede ser remarketing: se guarda en `ids` pero no alcanza para afirmar
 *  que se miden conversiones. */
export function sumarGtm(t: TrackingFacts, contenedores: GtmContenedor[]): TrackingFacts {
  if (contenedores.length === 0) return t;

  const leidos = contenedores.filter((c) => c.leido);
  const viaGtm =
    leidos.length === 0
      ? null
      : {
          ga4: leidos.some((c) => c.ga4Ids.length > 0),
          metaPixel: leidos.some((c) => c.metaPixel),
          googleAdsConversion: leidos.some((c) => c.conversionesAds > 0),
        };

  const ids = new Set(t.ids);
  for (const c of leidos) for (const id of [...c.ga4Ids, ...c.adsIds]) ids.add(id);

  const ga4 = t.ga4 || (viaGtm?.ga4 ?? false);
  const metaPixel = t.metaPixel || (viaGtm?.metaPixel ?? false);
  const googleAdsConversion = t.googleAdsConversion || (viaGtm?.googleAdsConversion ?? false);

  return {
    ...t,
    ga4,
    metaPixel,
    googleAdsConversion,
    ids: [...ids].sort(),
    algunTagPresente: t.algunTagPresente || ga4 || metaPixel || googleAdsConversion,
    viaGtm,
    contenedoresGtm: contenedores,
  };
}
