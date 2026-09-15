"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirEquipo } from "@/lib/consola/sesion";
import { diagnosticRequested, inngest } from "@/lib/inngest/client";

/** Alta de un diagnóstico interno desde la consola.
 *
 *  Es el mismo circuito que `POST /api/diagnostics` (empresa → diagnóstico en
 *  pending → token → evento de Inngest) con tres diferencias deliberadas:
 *
 *  1. Solo el paso 1 del form: sin contacto. Como el índice único de
 *     companies es sobre lower(contact_email) y un NULL no choca con otro
 *     NULL, no hay límite de uno por email.
 *  2. Escribe con la SESIÓN, no con la secret key: las policies de INSERT de
 *     docs/diagnosticos-internos.sql exigen el dominio del equipo y que la
 *     fila salga con origen 'consola' y firmada por quien la crea.
 *  3. Queda con origen 'consola', así no se mezcla con los leads. */

// Más laxo que el paso 1 de app/api/diagnostics/route.ts a propósito: ahí todo
// es obligatorio, acá solo el nombre. Un alta interna se carga con lo poco que
// se sabe de la empresa y el equipo asume el costo de un informe sin contexto.
// `province` guarda la localidad con su provincia, igual que en el form.
const schema = z.object({
  name: z.string().trim().min(1, "Falta el nombre de la empresa"),
  website: z.string().trim().url("El sitio no es una URL válida").optional().or(z.literal("")),
  industry: z.string().trim().optional(),
  province: z.string().trim().optional(),
  client_type: z.enum(["mayorista", "minorista", "ambos"]).optional(),
});

export type ResultadoAlta = { ok: false; error: string };

export async function generarDiagnostico(datos: unknown): Promise<ResultadoAlta> {
  const parsed = schema.safeParse(datos);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const { supabase, email } = await exigirEquipo();

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      name: data.name,
      website: data.website || null,
      industry: data.industry || null,
      province: data.province || null,
      client_type: data.client_type || null,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    return { ok: false, error: mensajeRls("la empresa", companyError?.message) };
  }

  const { data: diagnostic, error: diagError } = await supabase
    .from("diagnostics")
    .insert({
      company_id: company.id,
      status: "pending",
      // La columna es obligatoria. En un interno no se usa: la solapa de
      // internos no muestra ni cambia el estado de lead.
      lead_status: "nuevo",
      origen: "consola",
      creado_por: email,
    })
    .select("id")
    .single();

  if (diagError || !diagnostic) {
    return { ok: false, error: mensajeRls("el diagnóstico", diagError?.message) };
  }

  // El token es lo que permite abrir el informe en /d/[token]. Si falla, el
  // diagnóstico igual se analiza y se ve en la consola; solo falta el link.
  const { error: tokenError } = await supabase
    .from("share_tokens")
    .insert({ diagnostic_id: diagnostic.id });
  if (tokenError) {
    console.error(`[internos] sin token para ${diagnostic.id}:`, tokenError.message);
  }

  // Si el evento no sale, la fila queda en 'pending' y el botón de reintentar
  // del detalle la rescata pasado el umbral de colgado. No se corta el alta.
  try {
    await inngest.send(diagnosticRequested.create({ diagnosticId: diagnostic.id }));
  } catch (error) {
    console.error(`[internos] no se pudo encolar ${diagnostic.id}: queda en pending`, error);
  }

  revalidatePath("/app/internos");
  // redirect() corta la ejecución tirando: va fuera de cualquier try/catch.
  redirect(`/app/internos/${diagnostic.id}`);
}

/** Con RLS, un INSERT sin policy falla con un error de "row-level security".
 *  Es el síntoma de no haber corrido el SQL, así que se dice cuál. */
function mensajeRls(que: string, detalle?: string): string {
  // Sin la columna, PostgREST contesta "Could not find the 'origen' column".
  if (detalle && /row-level security|'origen'|'creado_por'/i.test(detalle)) {
    return `No se pudo crear ${que}: falta aplicar docs/diagnosticos-internos.sql en Supabase.`;
  }
  return `No se pudo crear ${que}${detalle ? ` (${detalle})` : ""}.`;
}
