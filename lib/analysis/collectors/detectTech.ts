import "server-only";

/** Huellas de plataforma y librerías en el HTML. Best-effort por definición:
 *  detectamos lo que deja rastro evidente. Que no aparezca nada NO significa
 *  que el sitio sea a medida — significa que no pudimos identificarlo. */

export type LibreriaDetectada = {
  nombre: string;
  /** Versión solo si está en el fuente (nombre de archivo o querystring). */
  version: string | null;
  /** true si sabemos que la rama es antigua. null si no podemos juzgarlo. */
  desactualizada: boolean | null;
};

export type TechFacts = {
  /** CMS/plataforma, si es evidente. null = no identificado. */
  cms: string | null;
  /** Constructor visual sobre el CMS (Elementor, Divi…). */
  pageBuilder: string | null;
  /** Plataforma de ecommerce, si la hay. */
  ecommerce: string | null;
  libraries: LibreriaDetectada[];
  /** Las pistas concretas que dispararon cada detección, para poder auditarla. */
  evidencia: string[];
};

type Huella = { nombre: string; test: RegExp; pista: string };

const CMS: Huella[] = [
  { nombre: "WordPress", test: /wp-content\/|wp-includes\/|<meta name="generator" content="WordPress/i, pista: "rutas wp-content/wp-includes" },
  { nombre: "Wix", test: /static\.wixstatic\.com|_wixCssStates|wix-code/i, pista: "assets de wixstatic" },
  { nombre: "Squarespace", test: /squarespace\.com|static1\.squarespace/i, pista: "assets de Squarespace" },
  { nombre: "Webflow", test: /webflow\.(com|io)|data-wf-page/i, pista: "atributos data-wf de Webflow" },
  { nombre: "Joomla", test: /\/media\/jui\/|<meta name="generator" content="Joomla/i, pista: "generator o rutas de Joomla" },
  { nombre: "Drupal", test: /drupal\.js|\/sites\/default\/files\//i, pista: "rutas de Drupal" },
  { nombre: "Blogger", test: /blogger\.com|blogspot\.com\/[^"']*\.js/i, pista: "scripts de Blogger" },
];

const ECOMMERCE: Huella[] = [
  { nombre: "Shopify", test: /cdn\.shopify\.com|Shopify\.theme/i, pista: "CDN de Shopify" },
  { nombre: "WooCommerce", test: /woocommerce|wc-ajax/i, pista: "clases o endpoints de WooCommerce" },
  { nombre: "Tiendanube", test: /tiendanube\.com|nuvemshop/i, pista: "assets de Tiendanube" },
  { nombre: "PrestaShop", test: /prestashop/i, pista: "referencias a PrestaShop" },
  { nombre: "Magento", test: /\/static\/version\d+\/frontend\/|Magento_/i, pista: "rutas de Magento" },
  { nombre: "VTEX", test: /vtexassets\.com|vtex\.com\.br/i, pista: "assets de VTEX" },
];

const PAGE_BUILDERS: Huella[] = [
  { nombre: "Elementor", test: /elementor-(page|widget|frontend)|\/elementor\//i, pista: "clases de Elementor" },
  { nombre: "Divi", test: /et_pb_|\/themes\/Divi\//i, pista: "clases et_pb_ de Divi" },
  { nombre: "WPBakery", test: /wpb_|js_composer/i, pista: "clases de WPBakery" },
  { nombre: "Beaver Builder", test: /fl-builder/i, pista: "clases fl-builder" },
];

/** jQuery 1.x y 2.x están fuera de soporte hace años; 3.x sigue vigente. */
const JQUERY_SRC = /jquery[.-]?(?:core|min|slim)?[.-]?(\d+\.\d+(?:\.\d+)?)?(?:\.min)?\.js(?:\?ver=(\d+\.\d+(?:\.\d+)?))?/i;

export function detectTech(html: string): TechFacts {
  const vacio: TechFacts = {
    cms: null,
    pageBuilder: null,
    ecommerce: null,
    libraries: [],
    evidencia: [],
  };

  try {
    const evidencia: string[] = [];

    const cms = primeraCoincidencia(CMS, html, evidencia);
    const ecommerce = primeraCoincidencia(ECOMMERCE, html, evidencia);
    const pageBuilder = primeraCoincidencia(PAGE_BUILDERS, html, evidencia);

    const libraries: LibreriaDetectada[] = [];
    const jquery = detectarJquery(html);
    if (jquery) {
      libraries.push(jquery);
      evidencia.push(
        jquery.version
          ? `jQuery ${jquery.version} en el fuente`
          : "jQuery presente, versión no declarada",
      );
    }

    return { cms, pageBuilder, ecommerce, libraries, evidencia };
  } catch {
    return vacio;
  }
}

function primeraCoincidencia(
  huellas: Huella[],
  html: string,
  evidencia: string[],
): string | null {
  for (const huella of huellas) {
    if (huella.test.test(html)) {
      evidencia.push(`${huella.nombre}: ${huella.pista}`);
      return huella.nombre;
    }
  }
  return null;
}

function detectarJquery(html: string): LibreriaDetectada | null {
  const coincidencia = html.match(JQUERY_SRC);
  const mencionado =
    coincidencia !== null || /\bjQuery\s*(\.|\()/.test(html) || /code\.jquery\.com/i.test(html);
  if (!mencionado) return null;

  const version = coincidencia?.[1] ?? coincidencia?.[2] ?? null;
  const mayor = version ? Number.parseInt(version, 10) : null;

  return {
    nombre: "jQuery",
    version,
    // Sin versión legible no opinamos: null, no false.
    desactualizada: mayor === null || Number.isNaN(mayor) ? null : mayor < 3,
  };
}
