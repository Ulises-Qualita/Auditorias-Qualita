import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Cliente de Supabase para el servidor CON sesión del usuario.
 *
 *  Es el tercer cliente del repo y no reemplaza a ninguno:
 *  - `client.ts` (browser, publishable key) → componentes cliente.
 *  - `admin.ts`  (secret key, sin sesión)   → ignora RLS; escrituras del pipeline.
 *  - este        (publishable key + cookies) → respeta RLS y actúa como el
 *    usuario logueado de la consola. Nunca ve datos que las policies no
 *    habiliten, así que no sirve para el form público.
 *
 *  Se crea por request: las cookies de Next son dinámicas y no se pueden
 *  compartir entre pedidos. */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. Se ignora a
            // propósito: el refresco del token lo hace el proxy (proxy.ts),
            // que sí puede escribirlas sobre la respuesta.
          }
        },
      },
    },
  );
}
