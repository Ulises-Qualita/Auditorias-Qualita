import { NextResponse } from "next/server";
import { z } from "zod";
import { diagnosticRequested, inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

// La secret key de Supabase no corre en edge.
export const runtime = "nodejs";
// El análisis ya no corre acá (lo ejecuta Inngest en /api/inngest), así que
// esta ruta solo hace 4 escrituras y publica un evento. El techo alto queda
// como red de seguridad, no porque haga falta.
export const maxDuration = 60;

/** String obligatorio con UN solo mensaje: zod distingue "no vino el campo"
 *  (error de tipo) de "vino vacío" (error de longitud), y al usuario le da lo
 *  mismo. Sin esto, el campo ausente devuelve "expected string, received
 *  undefined", que no se puede mostrar. */
const obligatorio = (mensaje: string) => z.string({ error: mensaje }).trim().min(1, mensaje);

// Validación de lo que manda el form (paso 1 + contacto del paso 2)
const schema = z.object({
  // Campo trampa del form: invisible para humanos. Lo aceptamos para que no
  // rompa la validación, pero se descarta antes (ver checkHoneypot) y NUNCA
  // se guarda en la base.
  company_website_url: z.string().optional(),
  // Todos obligatorios (2026-09-15): el sitio porque sin él el análisis no
  // tiene qué mirar, y rubro/localidad/tipo de cliente porque son el contexto
  // con el que se interpretan los hechos. `province` guarda la localidad junto
  // a su provincia ("Bahía Blanca, Buenos Aires"); la columna conserva el
  // nombre viejo para no migrar los diagnósticos ya emitidos.
  name: obligatorio("Falta el nombre de la empresa"),
  website: obligatorio("Falta el sitio web").url("El sitio no es una URL válida"),
  industry: obligatorio("Falta el rubro"),
  province: obligatorio("Falta la localidad"),
  client_type: z.enum(["mayorista", "minorista", "ambos"], {
    error: "Falta a quién le vende",
  }),
  contact_name: obligatorio("Falta tu nombre"),
  contact_email: obligatorio("Falta tu email").toLowerCase().email("El email no es válido"),
});

/** El honeypot con cualquier contenido delata a un bot. Se chequea sobre el
 *  body crudo porque corre antes del zod. */
function esBot(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const trampa = (body as Record<string, unknown>).company_website_url;
  return typeof trampa === "string" && trampa.trim().length > 0;
}

export async function POST(req: Request) {
  // 1. Parseo + validación
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // 1.b Honeypot. Un humano no ve ni alcanza ese campo, así que si viene con
  //     algo es un bot: cortamos antes de validar y de tocar la base. Devolvemos
  //     un 200 que parece un éxito a propósito, para no enseñarle qué lo delató.
  if (esBot(body)) {
    console.warn("[diagnostics] honeypot activado: descartamos el envío", {
      ua: req.headers.get("user-agent"),
      at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const supabase = createAdminClient();

  // 2. Crear la empresa. El índice único por email hace el control real.
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      name: data.name,
      website: data.website,
      industry: data.industry,
      province: data.province,
      client_type: data.client_type,
      contact_name: data.contact_name,
      contact_email: data.contact_email,
    })
    .select("id")
    .single();

  if (companyError) {
    // 23505 = violación de índice único => ese email ya tiene diagnóstico
    if (companyError.code === "23505") {
      return NextResponse.json(
        { error: "Este email ya generó un diagnóstico." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "No se pudo crear la empresa" }, { status: 500 });
  }

  // 3. Crear el diagnóstico en pending
  const { data: diagnostic, error: diagError } = await supabase
    .from("diagnostics")
    .insert({ company_id: company.id, status: "pending", lead_status: "nuevo" })
    .select("id")
    .single();

  if (diagError) {
    return NextResponse.json({ error: "No se pudo crear el diagnóstico" }, { status: 500 });
  }

  // 4. Token público para ver el informe sin login
  const { data: share } = await supabase
    .from("share_tokens")
    .insert({ diagnostic_id: diagnostic.id })
    .select("token")
    .single();

  // 5. Análisis en background: publicamos el evento y lo corre Inngest, fuera
  //    de este request y con reintentos (ver lib/inngest/functions.ts). El
  //    submit contesta al toque y la pantalla de analizando sigue el avance
  //    con /api/diagnostics/[id]/status, igual que antes.
  //    Si el envío del evento falla igual devolvemos 201: la empresa ya está
  //    creada y el índice único por email haría que un reintento del form
  //    choque con un 409. El diagnóstico queda en 'pending' y se puede volver
  //    a disparar desde la consola; el log es la señal de que hay que hacerlo.
  const diagnosticId = diagnostic.id;
  try {
    await inngest.send(diagnosticRequested.create({ diagnosticId }));
  } catch (error) {
    console.error(
      `[diagnostics] no se pudo encolar el análisis de ${diagnosticId}: queda en pending`,
      error,
    );
  }

  return NextResponse.json(
    { diagnosticId: diagnostic.id, token: share?.token ?? null },
    { status: 201 }
  );
}