import "server-only";
import { resolveTxt } from "node:dns/promises";

/** DMARC del dominio, por DNS. Requiere runtime Node (no edge).
 *
 *  Distinguimos tres cosas que es fácil confundir y que NO son lo mismo:
 *   - `exists: false`  → verificamos que no hay registro. Es un hallazgo.
 *   - `exists: null`   → el DNS falló. No sabemos nada; va como "a validar".
 *   - `policy: "none"` → hay registro pero no protege. Es otro hallazgo. */

export type PoliticaDmarc = "none" | "quarantine" | "reject";

export type DmarcFacts = {
  domain: string;
  /** null = no se pudo consultar. */
  exists: boolean | null;
  policy: PoliticaDmarc | null;
  /** Política para subdominios (sp=), si está declarada. */
  subdomainPolicy: PoliticaDmarc | null;
  /** Porcentaje de mensajes al que se aplica (pct=). Por defecto 100. */
  pct: number | null;
  /** El registro crudo, para poder auditar la lectura. */
  record: string | null;
  error: string | null;
};

const TIMEOUT_MS = 5_000;

export async function checkDmarc(domain: string): Promise<DmarcFacts> {
  const base: DmarcFacts = {
    domain,
    exists: null,
    policy: null,
    subdomainPolicy: null,
    pct: null,
    record: null,
    error: null,
  };

  const limpio = normalizarDominio(domain);
  if (!limpio) {
    return { ...base, error: `"${domain}" no es un dominio consultable` };
  }

  try {
    const registros = await conTimeout(resolveTxt(`_dmarc.${limpio}`), TIMEOUT_MS);

    // Cada registro TXT puede venir partido en varios strings de 255 bytes.
    const unidos = registros.map((partes) => partes.join("").trim());
    const dmarc = unidos.find((registro) => /^v=DMARC1\b/i.test(registro));

    if (!dmarc) {
      // Hay TXT en _dmarc pero ninguno es DMARC: a efectos prácticos, no hay.
      return { ...base, domain: limpio, exists: false };
    }

    return {
      ...base,
      domain: limpio,
      exists: true,
      record: dmarc,
      policy: leerPolitica(dmarc, "p"),
      subdomainPolicy: leerPolitica(dmarc, "sp"),
      pct: leerPct(dmarc),
    };
  } catch (error) {
    const codigo = (error as { code?: string }).code;
    // Ausencia verificada: el nombre no existe o no tiene TXT.
    if (codigo === "ENOTFOUND" || codigo === "ENODATA") {
      return { ...base, domain: limpio, exists: false };
    }
    return {
      ...base,
      domain: limpio,
      error:
        codigo === "ETIMEOUT" || codigo === "TIMEOUT"
          ? "La consulta DNS no respondió a tiempo"
          : `No se pudo consultar el DNS (${codigo ?? "error desconocido"})`,
    };
  }
}

function leerPolitica(registro: string, clave: "p" | "sp"): PoliticaDmarc | null {
  const coincidencia = registro.match(
    new RegExp(`(?:^|;)\\s*${clave}\\s*=\\s*(none|quarantine|reject)\\b`, "i"),
  );
  if (!coincidencia) return null;
  return coincidencia[1].toLowerCase() as PoliticaDmarc;
}

function leerPct(registro: string): number | null {
  const coincidencia = registro.match(/(?:^|;)\s*pct\s*=\s*(\d{1,3})\b/i);
  if (!coincidencia) return null;
  const valor = Number.parseInt(coincidencia[1], 10);
  return valor >= 0 && valor <= 100 ? valor : null;
}

/** Acepta un dominio o una URL completa y devuelve el hostname sin www. */
export function normalizarDominio(entrada: string): string | null {
  const texto = entrada.trim().toLowerCase();
  if (!texto) return null;

  let hostname = texto;
  if (texto.includes("://")) {
    try {
      hostname = new URL(texto).hostname;
    } catch {
      return null;
    }
  }
  hostname = hostname.replace(/^www\./, "").replace(/\/.*$/, "").replace(/:\d+$/, "");

  // Tiene que parecer un dominio: al menos un punto y caracteres válidos.
  if (!/^[a-z0-9ñ.-]+\.[a-z]{2,}$/i.test(hostname)) return null;
  return hostname;
}

/** `resolveTxt` no acepta signal, así que la carrera va por fuera. */
function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, rechazar) =>
      setTimeout(() => {
        const error = new Error("timeout") as Error & { code: string };
        error.code = "TIMEOUT";
        rechazar(error);
      }, ms).unref?.(),
    ),
  ]);
}
