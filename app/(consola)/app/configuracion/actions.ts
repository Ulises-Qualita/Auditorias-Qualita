"use server";

import { revalidatePath } from "next/cache";

import { CLAVE_MODELO } from "@/lib/analysis/modelo";
import { esModeloDisponible } from "@/lib/analysis/modelos";
import { exigirEquipo } from "@/lib/consola/sesion";

/** Escrituras de Configuración. Mismas reglas que las actions del detalle:
 *  sesión revalidada acá, cliente de sesión (RLS activa) e input validado. */

export type Resultado = { ok: true } | { ok: false; error: string };

export async function guardarModelo(modelo: unknown): Promise<Resultado> {
  // Solo ids de la lista: lo que llega del browser no es confiable, y un id
  // inventado haría fallar todas las auditorías siguientes contra la API.
  if (typeof modelo !== "string" || !esModeloDisponible(modelo)) {
    return { ok: false, error: "Modelo inválido." };
  }

  const { supabase, email } = await exigirEquipo();

  const { data, error } = await supabase
    .from("app_settings")
    .upsert({
      key: CLAVE_MODELO,
      value: modelo,
      updated_by: email,
      updated_at: new Date().toISOString(),
    })
    .select("key")
    .maybeSingle();

  if (error) {
    const faltaTabla = error.code === "PGRST205" || error.code === "42P01";
    return {
      ok: false,
      error: faltaTabla
        ? "Falta crear la tabla: correr docs/configuracion.sql en Supabase."
        : error.message,
    };
  }
  if (!data) {
    return { ok: false, error: "No se pudo guardar. ¿Está aplicado docs/configuracion.sql?" };
  }

  revalidatePath("/app/configuracion");
  return { ok: true };
}
