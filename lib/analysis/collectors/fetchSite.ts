import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Descarga del HTML del sitio. Es el insumo de casi todos los demás
 *  recolectores, así que su contrato es estricto: nunca tira, siempre devuelve
 *  un resultado que dice qué pasó. */

export type FetchSiteResult = {
  /** true solo si tenemos HTML utilizable. */
  ok: boolean;
  /** URL final después de redirects. null si nunca llegamos. */
  finalUrl: string | null;
  /** true si la URL final difiere de la pedida (redirect, www, https). */
  redirected: boolean;
  status: number | null;
  html: string | null;
  contentType: string | null;
  /** Milisegundos hasta tener el body. Es tiempo de red, no una métrica de
   *  performance: no lo presentes como tal. */
  elapsedMs: number | null;
  /** Motivo legible del fallo, para el warning. null si ok. */
  error: string | null;
};

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3_000_000; // 3 MB: más que eso no es HTML que nos sirva

/** Nos identificamos: no nos hacemos pasar por un navegador. */
const USER_AGENT =
  "QualitaDiagnostico/1.0 (+https://qualita.studio; auditoría de presencia digital)";

export type FetchSiteOptions = {
  /** Para URLs que NO cargó una persona sino el modelo (la herramienta
   *  `leer_pagina`): antes de cada salto, incluidos los redirects, se resuelve
   *  el dominio y se rechaza cualquier IP privada, de loopback o de metadata
   *  de la nube. Sin esto, un texto que el modelo leyó en una página podría
   *  hacer que el servidor le pegue a su propia red. */
  soloPublico?: boolean;
};

/** Saltos de redirect que se siguen a mano en modo `soloPublico`. */
const MAX_REDIRECTS = 5;

export async function fetchSite(
  url: string,
  { soloPublico = false }: FetchSiteOptions = {},
): Promise<FetchSiteResult> {
  const vacio: FetchSiteResult = {
    ok: false,
    finalUrl: null,
    redirected: false,
    status: null,
    html: null,
    contentType: null,
    elapsedMs: null,
    error: null,
  };

  let objetivo: URL;
  try {
    objetivo = new URL(url);
  } catch {
    return { ...vacio, error: `La URL "${url}" no es válida` };
  }
  if (objetivo.protocol !== "http:" && objetivo.protocol !== "https:") {
    return { ...vacio, error: `Protocolo no soportado: ${objetivo.protocol}` };
  }

  const inicio = Date.now();
  try {
    const pedir = (destino: URL, redirect: RequestRedirect) =>
      fetch(destino, {
        redirect,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "es-AR,es;q=0.9",
        },
        cache: "no-store",
      });

    let respuesta: Response;
    let finalUrl: string;

    if (!soloPublico) {
      respuesta = await pedir(objetivo, "follow");
      finalUrl = respuesta.url || objetivo.toString();
    } else {
      // Redirects a mano: cada salto se valida antes de pedirlo, porque un
      // sitio público puede redirigir a una IP interna.
      let actual = objetivo;
      for (let salto = 0; ; salto += 1) {
        const bloqueo = await destinoBloqueado(actual);
        if (bloqueo) return { ...vacio, error: bloqueo };

        respuesta = await pedir(actual, "manual");
        const siguiente = respuesta.headers.get("location");
        if (respuesta.status < 300 || respuesta.status >= 400 || !siguiente) break;
        if (salto >= MAX_REDIRECTS) {
          return { ...vacio, status: respuesta.status, error: "Demasiados redirects" };
        }
        await respuesta.body?.cancel().catch(() => {});
        actual = new URL(siguiente, actual);
        if (actual.protocol !== "http:" && actual.protocol !== "https:") {
          return { ...vacio, error: `Redirect a un protocolo no soportado: ${actual.protocol}` };
        }
      }
      finalUrl = actual.toString();
    }

    const contentType = respuesta.headers.get("content-type");
    const base = {
      finalUrl,
      redirected: finalUrl !== objetivo.toString(),
      status: respuesta.status,
      contentType,
      elapsedMs: Date.now() - inicio,
    };

    if (!respuesta.ok) {
      return {
        ...vacio,
        ...base,
        error: `El sitio respondió ${respuesta.status}`,
      };
    }

    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      return {
        ...vacio,
        ...base,
        error: `La respuesta no es HTML (${contentType})`,
      };
    }

    const html = await leerConTope(respuesta);
    if (html === null) {
      return { ...vacio, ...base, error: "No se pudo leer el cuerpo de la respuesta" };
    }

    return {
      ok: true,
      ...base,
      elapsedMs: Date.now() - inicio,
      html,
      error: null,
    };
  } catch (error) {
    return {
      ...vacio,
      elapsedMs: Date.now() - inicio,
      error: describirError(error),
    };
  }
}

/** Lee el body cortando en MAX_BYTES. Un HTML truncado sigue sirviendo para
 *  los chequeos de <head>, que es donde vive casi todo lo que buscamos. */
async function leerConTope(respuesta: Response): Promise<string | null> {
  if (!respuesta.body) return null;

  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder("utf-8", { fatal: false });
  const partes: string[] = [];
  let leidos = 0;

  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (!value) continue;
      leidos += value.byteLength;
      partes.push(decodificador.decode(value, { stream: true }));
      if (leidos >= MAX_BYTES) break;
    }
    partes.push(decodificador.decode());
  } catch {
    return partes.length > 0 ? partes.join("") : null;
  } finally {
    await lector.cancel().catch(() => {});
  }

  return partes.join("");
}

/** Motivo del bloqueo si la URL apunta a algo que no es internet público, o
 *  null si se puede pedir. Resuelve TODAS las IPs del dominio: alcanza con
 *  que una sea interna para rechazarlo. */
async function destinoBloqueado(url: URL): Promise<string | null> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || /^localhost$/i.test(host) || /\.(local|internal|localhost)$/i.test(host)) {
    return "La URL apunta a una dirección interna";
  }

  let direcciones: string[];
  if (isIP(host)) {
    direcciones = [host];
  } else {
    try {
      direcciones = (await lookup(host, { all: true })).map((d) => d.address);
    } catch {
      return "El dominio no resuelve por DNS";
    }
  }

  return direcciones.some(esIpPrivada) ? "La URL apunta a una dirección interna" : null;
}

function esIpPrivada(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local, incluida la metadata de la nube
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe80") ||
    v6.startsWith("ff")
  );
}

function describirError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return `El sitio no respondió en ${TIMEOUT_MS / 1000} segundos`;
    }
    if (error.name === "AbortError") return "La descarga se canceló";
    // fetch envuelve los errores de red/DNS/TLS en un TypeError genérico.
    const causa = (error as { cause?: { code?: string } }).cause?.code;
    if (causa === "ENOTFOUND") return "El dominio no resuelve por DNS";
    if (causa === "ECONNREFUSED") return "El servidor rechazó la conexión";
    if (causa?.startsWith("CERT") || causa?.includes("SSL")) {
      return `Problema con el certificado del sitio (${causa})`;
    }
    return causa ? `No se pudo acceder al sitio (${causa})` : error.message;
  }
  return "No se pudo acceder al sitio";
}
