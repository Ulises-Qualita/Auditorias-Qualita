import "server-only";

import { z } from "zod";

import { facts as factsSchema } from "@/lib/consola/facts";
import { TEXTOS_MEJORAS } from "./mejorasPageSpeed";

/** Los hechos deterministas que el informe público PUEDE mostrar.
 *
 *  `results.ts` descarta `facts` entero para que la evidencia cruda (URLs
 *  internas, teléfonos, mails, motivos técnicos) no viaje a ningún componente.
 *  Pero las láminas de la matriz de contacto, la medición y los números
 *  protagonistas tienen que salir de datos verificados por código, no del
 *  texto del modelo. Esto es el punto medio: se parsea en servidor y se
 *  proyecta a estados, booleanos y conteos. Nada más sale de acá.
 *
 *  REGLA que ordena los tipos: "no detectado en el HTML inicial" NO es "no
 *  tiene". Por eso las vías y los tags llevan estado de tres valores, y la
 *  ausencia solo se afirma donde es un hecho (DMARC: lo contesta el DNS). */

export type Deteccion = "detectado" | "no_detectado" | "no_verificable";

export type ViaContacto = "formulario" | "telefono" | "mail" | "whatsapp";

export type HechosInforme = {
  contacto: {
    /** "detectado" si hay al menos una vía. */
    estado: Deteccion;
    vias: Record<ViaContacto, Deteccion>;
    viasDetectadas: number;
    /** null en informes viejos que no lo traen. */
    contactoEnMenu: boolean | null;
    /** Campos del primer formulario; null si no hay formulario detectado. */
    camposFormulario: number | null;
  } | null;
  medicion: {
    /** Si la home no se pudo leer, cada tag es no verificable. */
    ga4: Deteccion;
    gtm: Deteccion;
    metaPixel: Deteccion;
    googleAdsConversion: Deteccion;
    tagsDetectados: number;
  };
  dmarc: {
    /** true / false son hechos del DNS; null = la consulta no se pudo hacer. */
    existe: boolean | null;
    politica: string | null;
  } | null;
  seo: {
    paginasInternas: number;
    urlsCripticas: number;
  } | null;
  /** PageSpeed. null si no se midió (sin key, falló o informe anterior a
   *  collect-1.5.0): la lámina no se muestra, no se muestra vacía. */
  velocidad: VelocidadInforme | null;
};

export type CategoriaVelocidad = "rendimiento" | "accesibilidad" | "practicas" | "seo";

export type VelocidadInforme = {
  puntajes: Record<CategoriaVelocidad, number | null>;
  medidoEn: string | null;
  /** Visitantes reales. null sin tráfico suficiente para Google. */
  reales: {
    categoria: "FAST" | "AVERAGE" | "SLOW" | null;
    lcpMs: number | null;
    deTodoElDominio: boolean;
  } | null;
  /** Ya en lenguaje llano, sin repetir grupos, en orden de impacto. */
  mejoras: Array<{
    grupo: string;
    categoria: CategoriaVelocidad;
    titulo: string;
    detalle: string;
    /** Lighthouse le da menos de 50: va marcada. */
    grave: boolean;
  }>;
};

const soloFacts = z.object({ facts: factsSchema.nullish() });

export function extraerHechos(raw: unknown): HechosInforme | null {
  const parseado = soloFacts.safeParse(raw);
  const f = parseado.success ? parseado.data.facts : null;
  if (!f) return null;

  const sitioLeido = f.fetch?.ok === true;

  return {
    contacto: sitioLeido && f.contacto ? proyectarContacto(f.contacto) : null,
    medicion: proyectarMedicion(sitioLeido ? f.tracking : null),
    dmarc: f.dmarc
      ? { existe: f.dmarc.exists ?? null, politica: f.dmarc.policy ?? null }
      : null,
    seo:
      sitioLeido && f.seo && typeof f.seo.urlsInternasTotal === "number"
        ? {
            paginasInternas: f.seo.urlsInternasTotal,
            urlsCripticas: f.seo.urlsCripticas ?? 0,
          }
        : null,
    velocidad: proyectarVelocidad(f.pageSpeed),
  };
}

/** Cuántas mejoras llegan al informe. Las demás quedan en la consola. */
const MEJORAS_EN_INFORME = 6;
/** Tope por categoría en la primera pasada: sin él, rendimiento (que suele
 *  tener más auditorías) se llevaba los 6 lugares y dejaba afuera problemas
 *  graves de accesibilidad o de prácticas. */
const MEJORAS_POR_CATEGORIA_INFORME = 2;

type FactsPageSpeed = z.infer<typeof factsSchema>["pageSpeed"];
type MejoraInforme = VelocidadInforme["mejoras"][number];

function proyectarVelocidad(ps: FactsPageSpeed): VelocidadInforme | null {
  if (!ps?.disponible || !ps.puntajes) return null;

  // Candidatas: solo lo que tiene traducción (una mejora rara en jerga no
  // llega al cliente) y una por grupo. Vienen ordenadas por categoría y, dentro
  // de cada una, por impacto.
  const vistos = new Set<string>();
  const candidatas: MejoraInforme[] = [];
  for (const mejora of ps.mejoras ?? []) {
    const texto = TEXTOS_MEJORAS[mejora.id];
    if (!texto || vistos.has(texto.grupo)) continue;
    vistos.add(texto.grupo);
    candidatas.push({
      grupo: texto.grupo,
      categoria: mejora.categoria,
      titulo: texto.titulo,
      detalle: texto.detalle(mejora.ahorroKb ?? null),
      grave: typeof mejora.puntaje === "number" && mejora.puntaje < 50,
    });
  }

  // Las graves primero (sort estable: se mantiene el orden por categoría e
  // impacto). Primera pasada con tope por categoría para repartir; la segunda
  // completa los lugares libres con lo que quedó.
  candidatas.sort((a, b) => Number(b.grave) - Number(a.grave));
  const elegidas = new Set<MejoraInforme>();
  const porCategoria = new Map<CategoriaVelocidad, number>();
  for (const mejora of candidatas) {
    if (elegidas.size === MEJORAS_EN_INFORME) break;
    const usadas = porCategoria.get(mejora.categoria) ?? 0;
    if (usadas >= MEJORAS_POR_CATEGORIA_INFORME) continue;
    elegidas.add(mejora);
    porCategoria.set(mejora.categoria, usadas + 1);
  }
  for (const mejora of candidatas) {
    if (elegidas.size === MEJORAS_EN_INFORME) break;
    elegidas.add(mejora);
  }
  // Se muestran en el orden de las candidatas: graves primero, por categoría.
  const mejoras = candidatas.filter((mejora) => elegidas.has(mejora));

  return {
    puntajes: {
      rendimiento: ps.puntajes.rendimiento ?? null,
      accesibilidad: ps.puntajes.accesibilidad ?? null,
      practicas: ps.puntajes.practicas ?? null,
      seo: ps.puntajes.seo ?? null,
    },
    medidoEn: ps.medidoEn ?? null,
    reales: ps.crux
      ? {
          categoria:
            ps.crux.categoria === "FAST" || ps.crux.categoria === "AVERAGE" || ps.crux.categoria === "SLOW"
              ? ps.crux.categoria
              : null,
          lcpMs: ps.crux.lcpMs ?? null,
          deTodoElDominio: ps.crux.deTodoElDominio === true,
        }
      : null,
    mejoras,
  };
}

type FactsContacto = NonNullable<z.infer<typeof factsSchema>["contacto"]>;

function proyectarContacto(c: FactsContacto): NonNullable<HechosInforme["contacto"]> {
  // Informes anteriores a collect-1.2.0 traen solo los booleanos. En esa
  // versión `false` ya significaba "no visto en el HTML inicial", así que se
  // traduce a no_detectado, nunca a ausencia.
  const desdeBooleano = (valor: boolean | null | undefined): Deteccion =>
    valor ? "detectado" : "no_detectado";

  const vias: Record<ViaContacto, Deteccion> = c.estados
    ? {
        formulario: normalizar(c.estados.formulario),
        telefono: normalizar(c.estados.telefono),
        mail: normalizar(c.estados.mail),
        whatsapp: normalizar(c.estados.whatsapp),
      }
    : {
        formulario: desdeBooleano(c.formulario),
        telefono: desdeBooleano(c.telefonoTocable),
        mail: desdeBooleano(c.mailPublicado),
        whatsapp: desdeBooleano(c.whatsapp),
      };

  const viasDetectadas = Object.values(vias).filter((v) => v === "detectado").length;
  const hayNoVerificable = Object.values(vias).some((v) => v === "no_verificable");

  return {
    estado: viasDetectadas > 0 ? "detectado" : hayNoVerificable ? "no_verificable" : "no_detectado",
    vias,
    viasDetectadas,
    contactoEnMenu: c.contactoEnMenu ?? null,
    camposFormulario:
      vias.formulario === "detectado" ? (c.camposFormulario?.length ?? null) : null,
  };
}

function normalizar(estado: "detectado" | "no_detectado_html_inicial" | "no_verificable"): Deteccion {
  return estado === "no_detectado_html_inicial" ? "no_detectado" : estado;
}

type FactsTracking = z.infer<typeof factsSchema>["tracking"];

function proyectarMedicion(t: FactsTracking): HechosInforme["medicion"] {
  const de = (valor: boolean | null | undefined): Deteccion =>
    !t ? "no_verificable" : valor ? "detectado" : "no_detectado";

  const medicion = {
    ga4: de(t?.ga4),
    gtm: de(t?.gtm),
    metaPixel: de(t?.metaPixel),
    googleAdsConversion: de(t?.googleAdsConversion),
  };
  return {
    ...medicion,
    tagsDetectados: Object.values(medicion).filter((v) => v === "detectado").length,
  };
}
