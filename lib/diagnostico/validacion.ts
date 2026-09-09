/** Validación del formulario del cliente.
 *
 *  Replica los criterios del zod de `app/api/diagnostics/route.ts` para dar
 *  feedback antes de la request. NO es la fuente de verdad: el endpoint valida
 *  de nuevo y su resultado manda. Si cambian las reglas allá, actualizar acá.
 *  A propósito no importa zod: sería una segunda fuente de verdad disfrazada. */

export type CamposFormulario = {
  name: string;
  website: string;
  industry: string;
  province: string;
  client_type: string;
  contact_name: string;
  contact_email: string;
};

export type ErroresFormulario = Partial<Record<keyof CamposFormulario, string>>;

/** El endpoint valida con `z.url()`, que exige esquema: "tuempresa.com" daría
 *  400. Se lo agregamos nosotros en vez de hacerle aprender la regla. */
export function normalizarWebsite(valor: string): string {
  const limpio = valor.trim();
  if (!limpio) return "";
  if (/^https?:\/\//i.test(limpio)) return limpio;
  return `https://${limpio}`;
}

export function esUrlValida(valor: string): boolean {
  const normalizado = normalizarWebsite(valor);
  if (!normalizado) return true; // el sitio es opcional
  let url: URL;
  try {
    url = new URL(normalizado);
  } catch {
    return false;
  }
  // Un poco más estricto que el endpoint: pedimos un dominio con punto para
  // atajar typos ("https://tuempresa") que el server aceptaría igual.
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.hostname.includes(".") &&
    !url.hostname.startsWith(".") &&
    !url.hostname.endsWith(".")
  );
}

export function esEmailValido(valor: string): boolean {
  const limpio = valor.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio);
}

/** Solo los requeridos, para habilitar o no el botón de envío. */
export function requeridosCompletos(campos: CamposFormulario): boolean {
  return (
    campos.name.trim().length > 0 &&
    campos.contact_name.trim().length > 0 &&
    campos.contact_email.trim().length > 0
  );
}

/** Los dos pasos del formulario del cliente. */
export type Paso = 1 | 2;

/** Qué campo se muestra en qué paso. Lo usamos para validar de a un paso y
 *  para saber a cuál volver si el submit final encuentra algo mal atrás. */
export const CAMPOS_PASO: Record<Paso, readonly (keyof CamposFormulario)[]> = {
  1: ["name", "website", "industry", "province", "client_type"],
  2: ["contact_name", "contact_email"],
};

/** Requeridos del paso 1, para habilitar "Siguiente". El sitio es opcional,
 *  pero si lo cargaron mal tampoco tiene sentido dejar avanzar. */
export function requeridosPaso1Completos(campos: CamposFormulario): boolean {
  return campos.name.trim().length > 0 && esUrlValida(campos.website);
}

/** Solo los errores del paso pedido. Deriva de validarFormulario para no
 *  duplicar criterios. */
export function validarPaso(paso: Paso, campos: CamposFormulario): ErroresFormulario {
  const todos = validarFormulario(campos);
  const errores: ErroresFormulario = {};
  for (const campo of CAMPOS_PASO[paso]) {
    if (todos[campo]) errores[campo] = todos[campo];
  }
  return errores;
}

/** Primer paso que tenga algún error, o null si está todo bien. */
export function primerPasoConError(errores: ErroresFormulario): Paso | null {
  const conError = Object.keys(errores) as (keyof CamposFormulario)[];
  if (conError.some((campo) => CAMPOS_PASO[1].includes(campo))) return 1;
  return conError.length > 0 ? 2 : null;
}

export function validarFormulario(campos: CamposFormulario): ErroresFormulario {
  const errores: ErroresFormulario = {};

  if (!campos.name.trim()) {
    errores.name = "Falta el nombre de la empresa";
  }
  if (!esUrlValida(campos.website)) {
    errores.website = "El sitio no es una URL válida";
  }
  if (!campos.contact_name.trim()) {
    errores.contact_name = "Falta tu nombre";
  }
  if (!campos.contact_email.trim()) {
    errores.contact_email = "Falta tu email";
  } else if (!esEmailValido(campos.contact_email)) {
    errores.contact_email = "El email no es válido";
  }

  return errores;
}

/** Arma el JSON que espera el endpoint. Los opcionales vacíos van como ""
 *  porque el schema los acepta con `.or(z.literal(""))`.
 *  `honeypot` es el campo trampa: un humano siempre lo manda vacío. Va tal cual
 *  y decide el endpoint; acá no filtramos nada. */
export function armarPayload(campos: CamposFormulario, honeypot = "") {
  return {
    company_website_url: honeypot,
    name: campos.name.trim(),
    website: normalizarWebsite(campos.website),
    industry: campos.industry.trim(),
    province: campos.province.trim(),
    ...(campos.client_type ? { client_type: campos.client_type } : {}),
    contact_name: campos.contact_name.trim(),
    contact_email: campos.contact_email.trim().toLowerCase(),
  };
}
