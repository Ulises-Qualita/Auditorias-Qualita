import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Guardia de la consola interna.
 *
 *  En Next 16 `middleware.ts` pasó a llamarse `proxy.ts` (misma
 *  funcionalidad, runtime Node.js por defecto).
 *
 *  Hace dos cosas y nada más:
 *  1. Refresca la sesión de Supabase (getUser() renueva el token y las
 *     cookies se escriben sobre la respuesta que devolvemos).
 *  2. Rebota a /login si no hay usuario.
 *
 *  El matcher cubre SOLO /app/*: el form público, el informe /d/[token] y
 *  /api/diagnostics no pasan por acá y siguen siendo anónimos.
 *
 *  Es un chequeo optimista: la verdad la vuelve a verificar el layout de
 *  /app con su propio getUser(). */

export async function proxy(request: NextRequest) {
  // Se arranca de una respuesta pass-through para poder ir acumulando
  // las cookies que Supabase quiera setear al refrescar el token.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  // Devolver ESTA respuesta y no una nueva: acá viven las cookies del token
  // refrescado. Si se pierde, la sesión se cae sola al vencer el access token.
  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};
