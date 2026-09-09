import "server-only";

/** Detección de medición sobre el HTML servido.
 *
 *  LÍMITE IMPORTANTE, respetarlo al redactar hallazgos: esto ve solo el HTML
 *  inicial. Un tag cargado por GTM, por un script diferido o inyectado por
 *  JS no aparece acá. Por eso `true` significa "verificado presente", pero
 *  `false` significa "no visible en el HTML inicial" — NO "no tiene". Esa
 *  distinción es la diferencia entre un dato y una acusación falsa. */

export type TrackingFacts = {
  ga4: boolean;
  gtm: boolean;
  metaPixel: boolean;
  googleAdsConversion: boolean;
  /** Analytics viejo: si aparece, es señal de medición desactualizada. */
  universalAnalyticsLegacy: boolean;
  /** Ids efectivamente encontrados en el fuente. Vacío si no hay ninguno. */
  ids: string[];
  /** true si hay algún tag detectado. */
  algunTagPresente: boolean;
};

const VACIO: TrackingFacts = {
  ga4: false,
  gtm: false,
  metaPixel: false,
  googleAdsConversion: false,
  universalAnalyticsLegacy: false,
  ids: [],
  algunTagPresente: false,
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
    };
  } catch {
    return { ...VACIO, ids: [] };
  }
}
