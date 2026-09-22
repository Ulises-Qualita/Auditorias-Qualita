import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

import { checkDmarc, normalizarDominio } from "./collectors/checkDmarc";
import { detectContacto } from "./collectors/detectContacto";
import { detectTech } from "./collectors/detectTech";
import { detectTracking, sumarGtm } from "./collectors/detectTracking";
import { fetchSite } from "./collectors/fetchSite";
import { inspectGtm } from "./collectors/inspectGtm";
import { parseSeo } from "./collectors/parseSeo";

/** La herramienta `leer_pagina`: el modelo pide una URL y el CÓDIGO la lee.
 *
 *  La búsqueda web muestra lo que Google indexó de una página, pero no su
 *  código. Para la tabla de medición de la competencia y para comparar
 *  formularios hace falta el código: qué etiquetas carga, qué campos pide.
 *  Eso lo sabemos leer con los mismos recolectores de la home del cliente, así
 *  que la herramienta los corre sobre la URL que pida el modelo.
 *
 *  A diferencia de `web_search`, esta herramienta es NUESTRA: la API devuelve
 *  `stop_reason: "tool_use"`, la ejecutamos acá y le mandamos el resultado.
 *  Lo que devuelve es un hecho verificado por código, y así se guarda en
 *  `results.lecturas`: la lámina de medición se arma con eso, no con lo que
 *  el modelo diga que leyó.
 *
 *  Los mismos límites que la home: HTML inicial, sin ejecutar JavaScript. Lo
 *  que no se detecta no es ausencia. */

export const LECTURAS_VERSION = "lecturas-1.0.0";

/** Tope de lecturas por auditoría: hasta 3 homes de competidores y el resto
 *  para páginas internas del cliente (presupuesto, contacto, nosotros). Cada
 *  lectura es barata en plata —no es una búsqueda paga— pero su resultado
 *  entra al contexto y se reenvía en cada vuelta. */
export const MAX_LECTURAS = 8;

export const NOMBRE_HERRAMIENTA_LECTURA = "leer_pagina";

export const herramientaLectura: Anthropic.Messages.Tool = {
  name: NOMBRE_HERRAMIENTA_LECTURA,
  description:
    "Lee el HTML inicial de una página pública con los recolectores de Qualita y devuelve lo verificado: " +
    "título, descripción, encabezados, etiquetas de medición (GA4, Tag Manager y lo que carga adentro, píxel de Meta, " +
    "conversión de Google Ads), tecnología, vías de contacto con los campos del formulario, el código de respuesta " +
    "y, para dominios que no son el del cliente, la protección del correo (DMARC). No ejecuta JavaScript: lo que " +
    "no detecta puede cargar por JavaScript y no es ausencia. Usala para la home de cada competidor del mapa del " +
    `sector y para páginas internas del cliente que importan (presupuesto, contacto, nosotros). Tope: ${MAX_LECTURAS} lecturas.`,
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL completa, con https://" },
      para: {
        type: "string",
        enum: ["cliente", "competidor"],
        description: "Si la página es del sitio del cliente o de un competidor.",
      },
    },
    required: ["url", "para"],
  },
};

/** Lo que se guarda de cada lectura. Proyección chica y sin HTML. */
export type LecturaPagina = {
  url: string;
  para: "cliente" | "competidor";
  finalUrl: string | null;
  dominio: string | null;
  ok: boolean;
  status: number | null;
  error: string | null;
  titulo: string | null;
  descripcion: string | null;
  h1: string[];
  tracking: {
    ga4: boolean;
    gtm: boolean;
    metaPixel: boolean;
    googleAdsConversion: boolean;
    universalAnalyticsLegacy: boolean;
    /** null = no hay Tag Manager, o no se pudo leer su contenedor. */
    contenedorLeido: boolean | null;
  } | null;
  tech: { cms: string | null; ecommerce: string | null; pageBuilder: string | null } | null;
  contacto: {
    estado: string;
    estados: Record<string, string>;
    campos: string[];
    whatsapp: boolean;
    telefonoTocable: boolean;
    mailPublicado: boolean;
    formulariosTotal: number;
  } | null;
  /** Solo para dominios que no son el del cliente (el del cliente ya está en
   *  los facts). */
  dmarc: { exists: boolean | null; policy: string | null } | null;
  leidaEn: string;
};

export async function leerPagina(
  url: string,
  para: "cliente" | "competidor",
  dominioCliente: string | null,
): Promise<LecturaPagina> {
  const leidaEn = new Date().toISOString();
  const normalizada = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  const dominio = normalizarDominio(normalizada);
  const esOtroDominio = dominio !== null && dominio !== dominioCliente;

  const [descarga, dmarc] = await Promise.all([
    fetchSite(normalizada, { soloPublico: true }),
    esOtroDominio && dominio ? checkDmarc(dominio) : Promise.resolve(null),
  ]);

  const base: LecturaPagina = {
    url: normalizada,
    para,
    finalUrl: descarga.finalUrl,
    dominio,
    ok: descarga.ok,
    status: descarga.status,
    error: descarga.error,
    titulo: null,
    descripcion: null,
    h1: [],
    tracking: null,
    tech: null,
    contacto: null,
    dmarc: dmarc ? { exists: dmarc.exists, policy: dmarc.policy } : null,
    leidaEn,
  };

  if (!descarga.ok || !descarga.html) return base;
  const html = descarga.html;

  // Cada recolector tiene su try/catch, pero una página rara no puede tirar
  // abajo la auditoría: si uno falla, esa parte queda en null.
  const intentar = <T>(fn: () => T): T | null => {
    try {
      return fn();
    } catch {
      return null;
    }
  };

  const seo = intentar(() => parseSeo(html, descarga.finalUrl ?? normalizada));
  let tracking = intentar(() => detectTracking(html));
  const tech = intentar(() => detectTech(html));
  const contacto = intentar(() => detectContacto(html));

  let contenedorLeido: boolean | null = null;
  if (tracking?.gtm) {
    const contenedores = await inspectGtm(tracking.ids.filter((id) => id.startsWith("GTM-")));
    tracking = sumarGtm(tracking, contenedores);
    contenedorLeido = contenedores.length > 0 && contenedores.every((c) => c.leido);
  }

  return {
    ...base,
    titulo: seo?.title ?? null,
    descripcion: seo?.metaDescription ?? null,
    h1: seo?.h1Texts.slice(0, 3) ?? [],
    tracking: tracking
      ? {
          ga4: tracking.ga4,
          gtm: tracking.gtm,
          metaPixel: tracking.metaPixel,
          googleAdsConversion: tracking.googleAdsConversion,
          universalAnalyticsLegacy: tracking.universalAnalyticsLegacy,
          contenedorLeido,
        }
      : null,
    tech: tech ? { cms: tech.cms, ecommerce: tech.ecommerce, pageBuilder: tech.pageBuilder } : null,
    contacto: contacto
      ? {
          estado: contacto.estado,
          estados: contacto.estados,
          campos: contacto.camposFormulario.map((campo) => `${campo.nombre} (${campo.tipo})`).slice(0, 14),
          whatsapp: contacto.whatsapp,
          telefonoTocable: contacto.telefonoTocable,
          mailPublicado: contacto.mailPublicado,
          formulariosTotal: contacto.formulariosTotal,
        }
      : null,
  };
}

/** Lo que vuelve al modelo como tool_result. Es la misma lectura: el modelo
 *  tiene que ver exactamente lo que se guarda, para que no afirme de más. */
export function resultadoParaModelo(lectura: LecturaPagina): string {
  // La hora de lectura es para la auditoría nuestra, no para el modelo.
  return JSON.stringify({ ...lectura, leidaEn: undefined });
}

/** Lee lo que pidió el modelo en una respuesta con `stop_reason: "tool_use"`
 *  y devuelve los tool_result, en el mismo orden. Pasado el tope, contesta con
 *  un error en vez de leer: el modelo tiene que seguir con lo que tiene. */
/** Las lecturas de una corrida. `reservadas` cuenta también las que están
 *  en curso: las de una misma respuesta corren en paralelo. */
export type RegistroLecturas = { reservadas: number; lecturas: LecturaPagina[] };

export function registroInicial(): RegistroLecturas {
  return { reservadas: 0, lecturas: [] };
}

export async function ejecutarLecturas(
  respuesta: Anthropic.Message,
  registro: RegistroLecturas,
  dominioCliente: string | null,
): Promise<Anthropic.ToolResultBlockParam[]> {
  const pedidos = respuesta.content.filter(
    (bloque): bloque is Anthropic.ToolUseBlock => bloque.type === "tool_use",
  );

  return Promise.all(
    pedidos.map(async (pedido): Promise<Anthropic.ToolResultBlockParam> => {
      if (pedido.name !== NOMBRE_HERRAMIENTA_LECTURA) {
        return { type: "tool_result", tool_use_id: pedido.id, is_error: true, content: "Herramienta desconocida" };
      }

      const entrada = pedido.input as { url?: unknown; para?: unknown } | null;
      const url = typeof entrada?.url === "string" ? entrada.url : "";
      const para = entrada?.para === "cliente" ? "cliente" : "competidor";
      if (!url) {
        return { type: "tool_result", tool_use_id: pedido.id, is_error: true, content: "Falta la URL" };
      }

      // El cupo se reserva antes de leer: las lecturas de una misma respuesta
      // corren en paralelo y no pueden pasarse del tope entre todas.
      if (registro.reservadas >= MAX_LECTURAS) {
        return {
          type: "tool_result",
          tool_use_id: pedido.id,
          is_error: true,
          content: `Se agotaron las ${MAX_LECTURAS} lecturas de esta auditoría. Seguí con lo que ya tenés; lo que falte va "a validar".`,
        };
      }
      registro.reservadas += 1;

      const lectura = await leerPagina(url, para, dominioCliente);
      registro.lecturas.push(lectura);
      return { type: "tool_result", tool_use_id: pedido.id, content: resultadoParaModelo(lectura) };
    }),
  );
}
