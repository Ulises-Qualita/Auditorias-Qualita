import { NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

/** Vuelta del OAuth de Google. Canjea el `code` por sesión y valida dominio.
 *
 *  La restricción de dominio está en dos capas:
 *  1. El OAuth Client de Google es Internal → Google ya solo deja pasar
 *     cuentas @qualita.studio.
 *  2. Esta verificación server-side, que casi nunca se va a disparar. Se
 *     mantiene igual: si mañana el client pasa a External o alguien cambia
 *     el `hd`, esto es lo único que separa a un ajeno de la consola. */

export const runtime = "nodejs";

const DOMINIO = "@qualita.studio";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Google puede volver con error (usuario canceló, consent denegado) o sin
  // code si alguien entra a mano a la URL.
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email?.toLowerCase().endsWith(DOMINIO)) {
    // Sesión creada pero no habilitada: se cierra antes de redirigir para no
    // dejar cookies válidas de una cuenta ajena.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=dominio`);
  }

  return NextResponse.redirect(`${origin}/app`);
}
