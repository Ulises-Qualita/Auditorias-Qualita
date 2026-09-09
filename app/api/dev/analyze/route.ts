import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analysis/analyze";

/** Ruta de PRUEBA para correr el análisis a mano sobre un diagnóstico
 *  existente. No es parte del flujo del producto: el submit todavía deja el
 *  diagnóstico en 'pending' y no dispara nada. */

// checkDmarc usa node:dns, así que edge no sirve.
export const runtime = "nodejs";
// El análisis tarda: sin esto, el default de la plataforma lo puede cortar.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "Falta el id del diagnóstico" }, { status: 400 });
  }

  const resultado = await runAnalysis(id.trim());
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 500 });
}
