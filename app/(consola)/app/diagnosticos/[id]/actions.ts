"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ESTADOS_LEAD } from "@/lib/consola/leads";
import { MINUTOS_COLGADO } from "@/lib/consola/reintento";
import { exigirEquipo } from "@/lib/consola/sesion";
import { diagnosticRequested, inngest } from "@/lib/inngest/client";

/** Las escrituras de la consola.
 *
 *  Tres reglas, y ninguna es opcional:
 *
 *  1. Cada action revalida la sesión por su cuenta. El proxy protege la
 *     NAVEGACIÓN a /app/*, no las actions: una server action es un POST a la
 *     ruta donde se usa y se puede invocar sin pasar por la página. La
 *     autorización va acá, del lado del servidor, siempre.
 *  2. Se escribe con el cliente de sesión, nunca con el admin. Así la RLS
 *     sigue siendo la última línea de defensa aunque este archivo tenga un
 *     bug: el service_role la ignoraría.
 *  3. Todo input se valida con zod antes de tocar la base. Lo que llega a una
 *     action viene del browser y no es confiable, por más que la UI solo
 *     mande los 5 estados válidos. */

const idSchema = z.uuid();
const estadoSchema = z.enum(ESTADOS_LEAD);

export type Resultado = { ok: true } | { ok: false; error: string };

function revalidar(id: string) {
  revalidatePath(`/app/diagnosticos/${id}`);
  revalidatePath("/app/diagnosticos");
  // Las mismas acciones (revisar, reintentar) se usan en los internos.
  revalidatePath(`/app/internos/${id}`);
  revalidatePath("/app/internos");
  // El panel también cambia: los tiles y el embudo salen de estos mismos datos.
  revalidatePath("/app");
}

export async function cambiarEstadoLead(
  diagnosticId: string,
  nuevoEstado: string,
): Promise<Resultado> {
  const id = idSchema.safeParse(diagnosticId);
  const estado = estadoSchema.safeParse(nuevoEstado);
  if (!id.success || !estado.success) return { ok: false, error: "Datos inválidos." };

  const { supabase } = await exigirEquipo();

  const { data, error } = await supabase
    .from("diagnostics")
    .update({ lead_status: estado.data, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    // Con RLS, un update sin permiso no falla: actualiza cero filas en
    // silencio. Pedir la fila de vuelta es la única forma de distinguir
    // "guardado" de "la policy lo bloqueó".
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: "No se pudo guardar. ¿Está aplicada la policy de UPDATE (docs/rls-update-policies.sql)?",
    };
  }

  revalidar(id.data);
  return { ok: true };
}

/** La revisión humana: hasta acá el informe es preliminar y el cliente ve la
 *  pantalla de "todavía no está listo". Pasarlo a 'sent' es lo que lo vuelve
 *  oficial, así que queda registrado quién lo hizo. */
export async function marcarRevisado(diagnosticId: string): Promise<Resultado> {
  const id = idSchema.safeParse(diagnosticId);
  if (!id.success) return { ok: false, error: "Datos inválidos." };

  const { supabase, email } = await exigirEquipo();

  const { data, error } = await supabase
    .from("diagnostics")
    .update({ status: "sent", reviewed_by: email, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    // La guarda va en el WHERE y no en un `if` previo: con un chequeo en dos
    // pasos, dos pestañas abiertas pueden leer 'preliminary' las dos y
    // escribir las dos. Acá la segunda simplemente no matchea ninguna fila.
    .eq("status", "preliminary")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error:
        "No se pudo marcar como revisado. O ya estaba enviado, o falta la policy de UPDATE.",
    };
  }

  revalidar(id.data);
  return { ok: true };
}

/** Volver a encolar el análisis.
 *
 *  El caso que lo justifica: si `inngest.send()` falla en el alta (por
 *  ejemplo, sin el Dev Server levantado), el route handler igual devuelve 201
 *  y el diagnóstico queda en 'pending' sin que nada lo vuelva a tocar. Antes
 *  la única salida era un curl al Dev Server; ahora es un botón.
 *
 *  El orden importa. Primero movemos la fila con la condición en el WHERE y
 *  recién después publicamos el evento: así dos clicks (o dos pestañas)
 *  compiten por el mismo update y solo uno matchea, en vez de publicar dos
 *  eventos y correr el análisis dos veces sobre la misma fila. */
export async function reintentarAnalisis(diagnosticId: string): Promise<Resultado> {
  const id = idSchema.safeParse(diagnosticId);
  if (!id.success) return { ok: false, error: "Datos inválidos." };

  const { supabase } = await exigirEquipo();
  const limite = new Date(Date.now() - MINUTOS_COLGADO * 60_000).toISOString();

  const { data, error } = await supabase
    .from("diagnostics")
    .update({
      status: "pending",
      // El `results` de un fallo es `{ error, fallo_en }`: si no se limpia, la
      // pantalla sigue mostrando el error viejo mientras corre el intento
      // nuevo. El motivo ya se leyó en esta misma pantalla antes de apretar.
      results: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    // La misma regla que motivoReintento(), pero del lado de Postgres, que es
    // el único que puede aplicarla sin ventana de carrera.
    .or(`status.eq.failed,and(status.in.(pending,analyzing),updated_at.lt.${limite})`)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error:
        "No se pudo reencolar: el análisis ya terminó o hay un intento en curso. Recargá la página.",
    };
  }

  try {
    await inngest.send(diagnosticRequested.create({ diagnosticId: id.data }));
  } catch {
    // Acá no nos lo tragamos como en el alta: la fila queda en 'pending' y el
    // mensaje dice qué falta. Es exactamente el fallo que este botón repara.
    revalidar(id.data);
    return {
      ok: false,
      error:
        "El diagnóstico volvió a la cola, pero no se pudo publicar el evento. ¿Está corriendo el Dev Server de Inngest (npm run inngest)?",
    };
  }

  revalidar(id.data);
  return { ok: true };
}

/** Borra el diagnóstico de la base, sin papelera: no se puede deshacer.
 *
 *  El orden sigue a las FK: primero el token (apunta al diagnóstico), después
 *  el diagnóstico, y por último la empresa si quedó sin diagnósticos. Sin ese
 *  último paso, el índice único sobre el email seguiría bloqueando a esa
 *  empresa para volver a diagnosticarse. */
export async function eliminarDiagnostico(diagnosticId: string): Promise<Resultado> {
  const id = idSchema.safeParse(diagnosticId);
  if (!id.success) return { ok: false, error: "Datos inválidos." };

  const { supabase } = await exigirEquipo();

  const { error: errorTokens } = await supabase
    .from("share_tokens")
    .delete()
    .eq("diagnostic_id", id.data);
  if (errorTokens) return { ok: false, error: errorTokens.message };

  const { data, error } = await supabase
    .from("diagnostics")
    .delete()
    .eq("id", id.data)
    // Igual que en el update: sin policy, RLS borra cero filas sin quejarse.
    .select("company_id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error:
        "No se pudo eliminar. O ya no existía, o falta la policy de DELETE (docs/rls-delete-policies.sql).",
    };
  }

  if (data.company_id) {
    const { count } = await supabase
      .from("diagnostics")
      .select("id", { count: "exact", head: true })
      .eq("company_id", data.company_id);
    if (count === 0) {
      await supabase.from("companies").delete().eq("id", data.company_id);
    }
  }

  revalidar(id.data);
  return { ok: true };
}
