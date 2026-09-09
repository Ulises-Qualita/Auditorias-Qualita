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
    .select("status, share_tokens(token)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Diagnóstico no encontrado" }, { status: 404 });
  }

  // El join viene como objeto o array según cómo infiera el cliente.
  const share = Array.isArray(data.share_tokens) ? data.share_tokens[0] : data.share_tokens;

  return NextResponse.json(
    { status: data.status, token: share?.token ?? null },
    // Es un endpoint de polling: cachearlo lo volvería inútil.
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
