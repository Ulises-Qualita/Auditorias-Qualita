"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ESTADOS_LEAD } from "@/lib/consola/leads";
import { createServerSupabase } from "@/lib/supabase/server";

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

const DOMINIO = "@qualita.studio";

const idSchema = z.uuid();
const estadoSchema = z.enum(ESTADOS_LEAD);

export type Resultado = { ok: true } | { ok: false; error: string };

/** Falta de permiso = excepción, no un `{ ok: false }`: no es un error que la
 *  UI deba mostrar y reintentar, es alguien que no debería estar acá. */
async function exigirEquipo() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email?.toLowerCase().endsWith(DOMINIO)) {
    throw new Error("No autorizado.");
  }

  return { supabase, email: user.email };
}

function revalidar(id: string) {
  revalidatePath(`/app/diagnosticos/${id}`);
  revalidatePath("/app/diagnosticos");
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
