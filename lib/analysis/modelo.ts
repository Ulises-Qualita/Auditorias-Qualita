import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { esModeloDisponible } from "./modelos";

/** Qué modelo usa la próxima auditoría.
 *
 *  Manda lo que se eligió en /app/configuracion (tabla app_settings). Si no
 *  hay nada guardado —o la tabla todavía no existe porque falta correr
 *  docs/configuracion.sql— se cae a ANTHROPIC_MODEL, que era el único camino
 *  antes. Así la solapa suma una opción sin romper lo que ya andaba. */

export const CLAVE_MODELO = "modelo_analisis";

/** De dónde salió el modelo, para que la consola lo pueda explicar. */
export type OrigenModelo = "consola" | "entorno" | "ninguno";

export async function modeloDeAnalisis(
  supabase: SupabaseClient,
): Promise<{ modelo: string | null; origen: OrigenModelo }> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CLAVE_MODELO)
    .maybeSingle();

  const guardado = !error && typeof data?.value === "string" ? data.value : null;
  // Un id que dejó de estar en la lista (se sacó un modelo) no se usa: mejor
  // el del entorno que uno que ya no ofrecemos ni sabemos cobrar.
  if (guardado && esModeloDisponible(guardado)) return { modelo: guardado, origen: "consola" };

  const entorno = process.env.ANTHROPIC_MODEL?.trim();
  return entorno ? { modelo: entorno, origen: "entorno" } : { modelo: null, origen: "ninguno" };
}
