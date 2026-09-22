import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

import type { AnalysisOutput } from "./schema";

/** La búsqueda web del análisis: la herramienta, su tope y la auditoría de lo
 *  que se buscó.
 *
 *  El tool `web_search` lo ejecuta Anthropic del lado del servidor: se declara
 *  en la llamada y las búsquedas, junto con sus resultados, vuelven como
 *  bloques dentro de la misma respuesta. Acá no hacemos ninguna request HTTP;
 *  lo que hace este módulo es decidir la herramienta, acotarla y después leer
 *  de la respuesta QUÉ se buscó y QUÉ devolvió, para poder guardarlo y
 *  auditarlo.
 *
 *  Solo corre en modo live. El mock deriva todo de los facts y no busca nada. */

/** Versión del componente de búsqueda, para `method_version`. Subirla cuando
 *  cambie qué se investiga o cómo se acota. */
export const WEBSEARCH_VERSION = "websearch-1.0.0";

/** TOPE DE BÚSQUEDAS POR AUDITORÍA.
 *
 *  Es el control de costo principal de esta etapa, y el que más pesa: cada
 *  búsqueda se cobra aparte (USD 10 cada 1.000, ver PRECIO_BUSQUEDA_WEB en
 *  costo.ts), pero lo caro son los resultados, que entran al contexto como
 *  tokens de input y se reenvían en cada vuelta del bucle de la herramienta.
 *  Medido con Opus 4.8: 17 búsquedas dieron ~245.000 tokens de input y USD
 *  1,61 de auditoría, contra USD 0,16 sin búsqueda. El costo sube casi lineal
 *  con el tope.
 *
 *  28 es el presupuesto para el recorrido completo del prompt: primero lo de
 *  afuera (posiciones, competencia, ficha, redes, pauta) y después las
 *  páginas internas del propio sitio y cómo las indexó Google. El orden de
 *  prioridad está en el prompt, así que si se agota, lo que queda sin mirar
 *  es lo último de la lista y sale como "a_validar".
 *
 *  Se puede mover con la variable de entorno WEBSEARCH_MAX_USES; en 0 la
 *  búsqueda queda apagada y el análisis vuelve a ser solo facts del sitio. */
export const MAX_BUSQUEDAS = 28;

/** Techo duro, por si alguien escribe 500 en la variable de entorno. */
const TOPE_MAXIMO = 40;

export function topeBusquedas(): number {
  const crudo = process.env.WEBSEARCH_MAX_USES?.trim();
  if (!crudo) return MAX_BUSQUEDAS;
  const valor = Number.parseInt(crudo, 10);
  if (!Number.isFinite(valor) || valor < 0) return MAX_BUSQUEDAS;
  return Math.min(valor, TOPE_MAXIMO);
}

/** Modelos que aceptan la versión nueva del tool (con filtrado dinámico de
 *  resultados: el modelo los filtra antes de que entren al contexto, así que
 *  se pagan menos tokens). Los demás —hoy Haiku 4.5— usan la versión básica.
 *  Un id con fecha (`claude-haiku-4-5-20251001`) se compara por prefijo. */
const MODELOS_TOOL_NUEVO = [
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "claude-fable-5",
  "claude-fable-5-1",
];

function soportaToolNuevo(model: string): boolean {
  return MODELOS_TOOL_NUEVO.some((id) => model === id || model.startsWith(`${id}-`));
}

/** La ubicación que se le pasa a la búsqueda para que los resultados sean los
 *  de Google Argentina y, cuando se puede, los de la zona de la empresa.
 *  `province` guarda "Bahía Blanca, Buenos Aires": ciudad y provincia. */
export function ubicacionDeBusqueda(province: string | null): Anthropic.Messages.UserLocation {
  const partes = (province ?? "")
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);

  return {
    type: "approximate",
    country: "AR",
    city: partes[0] ?? null,
    region: partes[1] ?? partes[0] ?? null,
    timezone: "America/Argentina/Buenos_Aires",
  };
}

/** La herramienta lista para pasarle a `messages.create`. `null` cuando el
 *  tope es 0: ahí la llamada va sin tools y no se gasta una sola búsqueda. */
export function herramientaBusqueda(
  model: string,
  tope: number,
  ubicacion: Anthropic.Messages.UserLocation,
): Anthropic.Messages.ToolUnion | null {
  if (tope <= 0) return null;

  // max_uses lo hace cumplir la API: pasado el tope, la herramienta devuelve
  // el error `max_uses_exceeded` en vez de seguir buscando. El tope no es una
  // sugerencia en el prompt, aunque también se lo digamos ahí.
  return soportaToolNuevo(model)
    ? { type: "web_search_20260209", name: "web_search", max_uses: tope, user_location: ubicacion }
    : { type: "web_search_20250305", name: "web_search", max_uses: tope, user_location: ubicacion };
}

/** Las herramientas de una llamada con el cupo de búsquedas que QUEDA en la
 *  auditoría. `max_uses` vale por llamada, no por auditoría: sin esto, cada
 *  llamada después de la primera tenía de nuevo el tope entero.
 *
 *  Tiene un costo: la definición de las herramientas es lo primero del
 *  prefijo cacheado, así que cambiar el cupo hace que esa llamada relea el
 *  contexto a precio completo (~USD 0,3 con Sonnet 5). Con el cupo intacto
 *  (ninguna búsqueda todavía) devuelve lo mismo y el caché se conserva.
 *
 *  Con 0 no se puede sacar la herramienta —con bloques de búsqueda en el
 *  historial la API rechaza el pedido— ni se sabe si acepta `max_uses: 0`: el
 *  que llama pasa a modo cierre (`tool_choice: none`) y esto deja 1, que no se
 *  usa. */
export function conBusquedasRestantes(
  herramientas: Anthropic.Messages.ToolUnion[],
  restantes: number,
): Anthropic.Messages.ToolUnion[] {
  return herramientas.map((herramienta) =>
    "name" in herramienta && herramienta.name === "web_search" && "max_uses" in herramienta
      ? ({ ...herramienta, max_uses: Math.max(1, restantes) } as Anthropic.Messages.ToolUnion)
      : herramienta,
  );
}

export type ResultadoBusqueda = { titulo: string; url: string };

export type BusquedaHecha = {
  /** Lo que el modelo escribió en el buscador. */
  query: string;
  resultados: ResultadoBusqueda[];
  /** Código de error de la herramienta, si esa búsqueda falló. */
  error?: string;
};

export type Investigacion = {
  version: string;
  /** El tope que regía en esta corrida. */
  tope: number;
  /** Cuántas búsquedas se hicieron de verdad. */
  hechas: number;
  busquedas: BusquedaHecha[];
  /** Las páginas que devolvieron esas búsquedas, sin repetir. Es la lista de
   *  "fuentes consultadas" de la nota de método. */
  fuentes: ResultadoBusqueda[];
  /** URLs que el modelo citó y que NO aparecen entre las que devolvió la
   *  búsqueda. Vacío es lo esperable; si trae algo, hay que mirarlo. */
  citasSinRespaldo: string[];
};

/** Lee de las respuestas qué se buscó y qué volvió.
 *
 *  Toma TODAS las respuestas de la corrida (el turno puede pausarse y seguir,
 *  y puede haber un reintento de corrección) para que el registro sea el de la
 *  auditoría entera y no el de la última llamada. */
export function extraerBusquedas(respuestas: Anthropic.Message[]): BusquedaHecha[] {
  const busquedas: BusquedaHecha[] = [];
  const porId = new Map<string, BusquedaHecha>();

  for (const respuesta of respuestas) {
    for (const bloque of respuesta.content) {
      if (bloque.type === "server_tool_use" && bloque.name === "web_search") {
        const entrada = bloque.input as { query?: unknown } | null;
        const query = typeof entrada?.query === "string" ? entrada.query : "(sin query)";
        const busqueda: BusquedaHecha = { query, resultados: [] };
        porId.set(bloque.id, busqueda);
        busquedas.push(busqueda);
        continue;
      }

      if (bloque.type === "web_search_tool_result") {
        const busqueda = porId.get(bloque.tool_use_id);
        if (!busqueda) continue;
        // El contenido es una LISTA cuando salió bien y un OBJETO de error
        // cuando falló (tope agotado, query muy larga, servicio caído).
        if (Array.isArray(bloque.content)) {
          busqueda.resultados = bloque.content.map((resultado) => ({
            titulo: resultado.title,
            url: resultado.url,
          }));
        } else {
          busqueda.error = bloque.content.error_code;
        }
      }
    }
  }

  return busquedas;
}

/** Las fuentes sin repetir, en el orden en que aparecieron. */
export function fuentesDe(busquedas: BusquedaHecha[]): ResultadoBusqueda[] {
  const vistas = new Set<string>();
  const fuentes: ResultadoBusqueda[] = [];
  for (const busqueda of busquedas) {
    for (const resultado of busqueda.resultados) {
      if (vistas.has(resultado.url)) continue;
      vistas.add(resultado.url);
      fuentes.push(resultado);
    }
  }
  return fuentes;
}

/** Todas las URLs que el modelo citó en los bloques de investigación.
 *
 *  Recorre el output entero buscando arrays `fuentes` en vez de nombrar cada
 *  bloque: así un campo nuevo en el esquema queda auditado sin tocar esto. */
export function citasDe(output: AnalysisOutput): string[] {
  const citas: string[] = [];

  const recorrer = (valor: unknown): void => {
    if (Array.isArray(valor)) {
      for (const item of valor) recorrer(item);
      return;
    }
    if (!valor || typeof valor !== "object") return;
    for (const [clave, contenido] of Object.entries(valor)) {
      if (clave === "fuentes" && Array.isArray(contenido)) {
        for (const url of contenido) if (typeof url === "string") citas.push(url);
        continue;
      }
      recorrer(contenido);
    }
  };

  recorrer(output);
  return citas;
}

/** El dominio, sin www y en minúsculas. null si no parece una URL. */
function dominio(url: string): string | null {
  const limpio = url.trim();
  if (!limpio) return null;
  try {
    const parseada = new URL(/^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`);
    return parseada.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Qué citó el modelo que la búsqueda no devolvió.
 *
 *  Se compara por DOMINIO y no por URL exacta: el modelo suele citar la página
 *  de la que salió el dato dentro de un sitio que sí apareció en los
 *  resultados, y eso está bien. Una cita de un dominio que nunca volvió de
 *  ninguna búsqueda, en cambio, es exactamente lo que no queremos: un dato
 *  afirmado sin respaldo. No corta el análisis —el informe igual se guarda—
 *  pero queda anotado en `results.investigacion` para poder revisarlo. */
export function auditarCitas(
  output: AnalysisOutput | null,
  fuentes: ResultadoBusqueda[],
): string[] {
  if (!output) return [];
  const dominiosBuscados = new Set(
    fuentes.map((fuente) => dominio(fuente.url)).filter((d): d is string => d !== null),
  );

  const sinRespaldo: string[] = [];
  for (const cita of citasDe(output)) {
    const dominioCitado = dominio(cita);
    if (!dominioCitado || !dominiosBuscados.has(dominioCitado)) {
      if (!sinRespaldo.includes(cita)) sinRespaldo.push(cita);
    }
  }
  return sinRespaldo;
}

/** El bloque que se guarda en `results.investigacion`. */
export function armarInvestigacion(
  /** null cuando la corrida falló antes de tener un output válido: ahí igual
   *  queremos guardar qué se buscó, aunque no haya citas que auditar. */
  output: AnalysisOutput | null,
  busquedas: BusquedaHecha[],
  tope: number,
): Investigacion {
  const fuentes = fuentesDe(busquedas);
  return {
    version: WEBSEARCH_VERSION,
    tope,
    hechas: busquedas.length,
    busquedas,
    fuentes,
    citasSinRespaldo: auditarCitas(output, fuentes),
  };
}
