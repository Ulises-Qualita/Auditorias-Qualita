import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/** Estado del diagnóstico para el polling de /analizando/[id].
 *
 *  Devuelve lo mínimo — `status` y el token del informe — y nada más: el
 *  `results` completo no hace falta para saber si terminó, y no exponerlo acá
 *  evita filtrar el informe antes de que un humano lo revise.
 *
 *  RLS está activo sin policies, así que la lectura pasa por el admin client:
 *  esto es server-only por definición. */

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: RouteContext<"/api/diagnostics/[id]/status">) {
  const { id } = await ctx.params;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("diagnostics")
    .select("status, updated_at, share_tokens(token)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Diagnóstico no encontrado" }, { status: 404 });
  }

  // El join viene como objeto o array según cómo infiera el cliente.
  const share = Array.isArray(data.share_tokens) ? data.share_tokens[0] : data.share_tokens;

  // Cuánto lleva en 'analyzing' (runAnalysis pisa updated_at al entrar). Se
  // calcula acá y no en el browser para no depender del reloj del cliente;
  // la pantalla de espera lo usa para no reiniciar el progreso al recargar.
  const transcurridoMs =
    data.status === "analyzing" && data.updated_at
      ? Math.max(0, Date.now() - new Date(data.updated_at).getTime())
      : null;

  return NextResponse.json(
    { status: data.status, token: share?.token ?? null, transcurridoMs },
    // Es un endpoint de polling: cachearlo lo volvería inútil.
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
