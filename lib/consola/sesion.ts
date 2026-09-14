import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

/** La autorización de las escrituras de la consola.
 *
 *  Vive acá y no en un archivo "use server": todo lo que exporta un archivo
 *  de actions queda invocable desde el browser, y esto no es una action.
 *
 *  Falta de permiso = excepción, no un `{ ok: false }`: no es un error que la
 *  UI deba mostrar y reintentar, es alguien que no debería estar acá. */

export const DOMINIO_EQUIPO = "@qualita.studio";

export async function exigirEquipo() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email?.toLowerCase().endsWith(DOMINIO_EQUIPO)) {
    throw new Error("No autorizado.");
  }

  return { supabase, email: user.email.toLowerCase() };
}
