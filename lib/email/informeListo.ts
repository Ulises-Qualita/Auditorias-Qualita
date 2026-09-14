import "server-only";

import { nivelDeScore } from "@/lib/diagnostico/results";
import { createAdminClient } from "@/lib/supabase/admin";

/** El mail "tu diagnóstico está listo", con el link a /d/[token].
 *
 *  Lo dispara la función de Inngest en su propio step, después de "analyze":
 *  si el envío falla se reintenta solo el mail, sin volver a correr (ni pagar)
 *  el análisis. Y el `Idempotency-Key` de Resend garantiza que un reintento no
 *  mande el mismo mail dos veces.
 *
 *  Va por la API HTTP de Resend con fetch, sin SDK: es una sola llamada.
 *
 *  Variables:
 *  - RESEND_API_KEY: sin ella no se envía nada (queda un warning). En local
 *    permite correr el flujo entero sin mandar mails reales.
 *  - EMAIL_FROM: remitente, con un dominio verificado en Resend. Mejor con
 *    nombre de persona que genérico: ayuda a que Gmail no lo mande a
 *    Promociones. Ej: "Ulises de Qualita <ulises@qualita.studio>".
 *  - APP_URL: la URL pública de la app, para armar el link. El job corre
 *    fuera de un request, así que no hay `origin` del que sacarla. */

const ENDPOINT = "https://api.resend.com/emails";
const RESPONDER_A = "hola@qualita.studio";

export type ResultadoMail =
  | { enviado: true; id: string | null }
  | { enviado: false; motivo: string };

/** Error que vale la pena reintentar (red, 429, 5xx de Resend). Lo demás
 *  (dominio sin verificar, email inválido, falta configuración) da igual a la
 *  segunda: se devuelve como `enviado: false` y queda en el log del step. */
export class ErrorMailTransitorio extends Error {}

export async function enviarInformeListo(diagnosticId: string): Promise<ResultadoMail> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const remitente = process.env.EMAIL_FROM?.trim();
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");

  if (!apiKey || !remitente || !appUrl) {
    const faltan = [
      !apiKey && "RESEND_API_KEY",
      !remitente && "EMAIL_FROM",
      !appUrl && "APP_URL",
    ].filter(Boolean);
    console.warn(`[email] no se envía el informe de ${diagnosticId}: falta ${faltan.join(", ")}`);
    return { enviado: false, motivo: `Falta configurar ${faltan.join(", ")}` };
  }

  const datos = await cargarDatos(diagnosticId);
  if ("motivo" in datos) return { enviado: false, motivo: datos.motivo };

  const contenido = armarMail({ ...datos, link: `${appUrl}/d/${datos.token}` });

  let respuesta: Response;
  try {
    respuesta = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Un mail por diagnóstico: si Inngest reintenta el step, Resend
        // reconoce la clave y no lo manda de nuevo.
        "Idempotency-Key": `informe-listo-${diagnosticId}`,
      },
      body: JSON.stringify({
        from: remitente,
        to: [datos.email],
        reply_to: RESPONDER_A,
        subject: contenido.asunto,
        html: contenido.html,
        text: contenido.texto,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error de red";
    throw new ErrorMailTransitorio(`Resend no respondió: ${detalle}`);
  }

  if (respuesta.status === 429 || respuesta.status >= 500) {
    throw new ErrorMailTransitorio(`Resend respondió ${respuesta.status}`);
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { id?: string; message?: string }
    | null;

  if (!respuesta.ok) {
    const motivo = `Resend rechazó el envío (${respuesta.status}): ${cuerpo?.message ?? "sin detalle"}`;
    console.error(`[email] informe ${diagnosticId}: ${motivo}`);
    return { enviado: false, motivo };
  }

  return { enviado: true, id: cuerpo?.id ?? null };
}

type DatosMail = {
  email: string;
  contacto: string | null;
  empresa: string;
  token: string;
  score: number | null;
};

async function cargarDatos(diagnosticId: string): Promise<DatosMail | { motivo: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("diagnostics")
    .select("status, score_general, companies(name, contact_name, contact_email), share_tokens(token)")
    .eq("id", diagnosticId)
    .maybeSingle();

  if (error) throw new ErrorMailTransitorio(`No se pudo leer el diagnóstico: ${error.message}`);
  if (!data) return { motivo: "El diagnóstico no existe" };

  // Solo se avisa lo que el cliente ya puede abrir.
  if (data.status !== "preliminary" && data.status !== "sent") {
    return { motivo: `El diagnóstico está en '${data.status}', no hay informe que mandar` };
  }

  // Los joins vienen como objeto o array según cómo infiera el cliente.
  const empresa = Array.isArray(data.companies) ? data.companies[0] : data.companies;
  const share = Array.isArray(data.share_tokens) ? data.share_tokens[0] : data.share_tokens;

  // Los diagnósticos internos no tienen contacto: no hay a quién escribirle.
  if (!empresa?.contact_email) return { motivo: "Sin email de contacto (diagnóstico interno)" };
  if (!share?.token) return { motivo: "El diagnóstico no tiene link público" };

  return {
    email: empresa.contact_email,
    contacto: empresa.contact_name ?? null,
    empresa: empresa.name,
    token: share.token,
    score: data.score_general,
  };
}

/** Escrito como lo mandaría una persona del equipo, no como una newsletter.
 *
 *  La primera versión tenía header navy con logo, banda de puntaje y botón con
 *  gradiente, y Gmail la clasificó en Promociones. Esta es a propósito casi
 *  texto plano: párrafos, un link a la vista y una firma. Sin imágenes, sin
 *  preheader oculto, sin tablas de maquetación. */
function armarMail({
  contacto,
  empresa,
  score,
  link,
}: DatosMail & { link: string }): { asunto: string; html: string; texto: string } {
  const nombre = primerNombre(contacto);
  const saludo = nombre ? `Hola ${nombre}, ¿cómo va?` : "Hola, ¿cómo va?";
  const asunto = `Tu diagnóstico digital de ${empresa}`;

  const puntaje =
    score === null
      ? ""
      : ` Sacó ${score} de 100, que en nuestra escala es "${nivelDeScore(score).label.toLowerCase()}".`;

  const parrafos = [
    saludo,
    `Ya está listo el diagnóstico de ${empresa}.${puntaje}`,
    "Ahí vas a ver cómo está el sitio canal por canal, dónde se pueden estar escapando consultas y por dónde conviene empezar.",
  ];
  const cierre = "Si querés que lo repasemos juntos, respondé este mail y coordinamos.";
  const firma = ["Saludos,", "Equipo de Qualita Studio"];

  const texto = [...parrafos, link, cierre, firma.join("\n")].join("\n\n");

  const e = escapar;
  const p = (contenido: string) =>
    `<p style="margin:0 0 16px;">${contenido}</p>`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(asunto)}</title>
</head>
<body style="margin:0;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#252851;">
<div style="max-width:560px;">
${parrafos.map((parrafo) => p(e(parrafo))).join("\n")}
${p(`<a href="${e(link)}" style="color:#B50CC5;font-weight:bold;">Ver el diagnóstico de ${e(empresa)}</a>`)}
${p(e(cierre))}
<p style="margin:0;">${firma.map(e).join("<br>")}</p>
</div>
</body>
</html>`;

  return { asunto, html, texto };
}

function primerNombre(nombre: string | null): string | null {
  const primero = nombre?.trim().split(/\s+/)[0];
  return primero ? primero : null;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
