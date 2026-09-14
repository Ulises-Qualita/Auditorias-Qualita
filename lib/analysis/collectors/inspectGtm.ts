import "server-only";

/** Qué carga el contenedor de Google Tag Manager.
 *
 *  Muchos sitios no ponen ningún tag en el HTML: ponen SOLO el snippet de GTM
 *  y desde ahí cargan GA4, el píxel de Meta y las conversiones de Ads. Mirando
 *  únicamente el HTML, a esos sitios se los acusaba de "no medir".
 *
 *  El contenedor publicado (gtm.js?id=GTM-XXXX) es público: es el mismo JS que
 *  baja cualquier visitante. Leerlo es determinista y no pide accesos. Lo que
 *  NO dice: si los tags disparan bien, qué eventos se miden de verdad o si la
 *  cuenta recibe datos. Eso sigue siendo "a validar" con acceso de lectura. */

export type GtmContenedor = {
  id: string;
  /** false = no se pudo bajar: lo de adentro queda no verificable. */
  leido: boolean;
  error: string | null;
  ga4Ids: string[];
  adsIds: string[];
  metaPixelIds: string[];
  metaPixel: boolean;
  /** Tags de conversión de Google Ads (__awct). */
  conversionesAds: number;
  /** Tags de evento de GA4 (__gaawe): formularios, clics, etc. */
  eventosGa4: number;
  /** Otras plataformas que carga el contenedor (TikTok, Clarity...). */
  otras: string[];
};

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 3_000_000;
/** Un sitio con más de 3 contenedores es rarísimo; el tope evita que un HTML
 *  lleno de ids nos haga bajar decenas de archivos. */
const MAX_CONTENEDORES = 3;

const ID_GTM = /^GTM-[A-Z0-9]{4,10}$/;

const OTRAS: Array<[RegExp, string]> = [
  [/analytics\.tiktok\.com|\bttq\.(load|page|track)/, "TikTok"],
  [/clarity\.ms/, "Microsoft Clarity"],
  [/static\.hotjar\.com/, "Hotjar"],
  [/snap\.licdn\.com|_linkedin_partner_id/, "LinkedIn"],
  [/bat\.bing\.com/, "Microsoft Ads"],
];

export async function inspectGtm(ids: string[]): Promise<GtmContenedor[]> {
  const unicos = [...new Set(ids.filter((id) => ID_GTM.test(id)))].slice(0, MAX_CONTENEDORES);
  return Promise.all(unicos.map(leerContenedor));
}

async function leerContenedor(id: string): Promise<GtmContenedor> {
  try {
    const res = await fetch(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return fallido(id, `Tag Manager respondió ${res.status}`);
    const js = (await res.text()).slice(0, MAX_BYTES);
    return analizarContenedor(id, js);
  } catch (error) {
    const motivo =
      error instanceof Error && error.name === "TimeoutError"
        ? `Tag Manager no respondió en ${TIMEOUT_MS / 1000} segundos`
        : error instanceof Error
          ? error.message
          : "error desconocido";
    return fallido(id, motivo);
  }
}

export function analizarContenedor(id: string, js: string): GtmContenedor {
  const unicos = (re: RegExp) => [...new Set(js.match(re) ?? [])].sort();
  // Cada tag del contenedor es un objeto {"function":"__tipo", ...}.
  const cuantos = (tipo: string) => js.split(`"function":"${tipo}"`).length - 1;

  // El HTML propio va escapado adentro de un string: fbq(\"init\",\"123\").
  const metaPixelIds = [
    ...new Set(
      [...js.matchAll(/fbq\(\s*\\?["']init\\?["']\s*,\s*\\?["'](\d{6,20})/g)].map((m) => m[1]),
    ),
  ];

  return {
    id,
    leido: true,
    error: null,
    ga4Ids: unicos(/\bG-[A-Z0-9]{6,12}\b/g),
    adsIds: unicos(/\bAW-\d{9,12}\b/g),
    metaPixelIds,
    metaPixel:
      metaPixelIds.length > 0 ||
      /connect\.facebook\.net\/[^"'\\]*\/fbevents\.js/.test(js) ||
      /facebook\.com\/tr\?id=\d+/.test(js),
    conversionesAds: cuantos("__awct"),
    eventosGa4: cuantos("__gaawe"),
    otras: OTRAS.filter(([re]) => re.test(js)).map(([, nombre]) => nombre),
  };
}

function fallido(id: string, error: string): GtmContenedor {
  return {
    id,
    leido: false,
    error,
    ga4Ids: [],
    adsIds: [],
    metaPixelIds: [],
    metaPixel: false,
    conversionesAds: 0,
    eventosGa4: 0,
    otras: [],
  };
}
