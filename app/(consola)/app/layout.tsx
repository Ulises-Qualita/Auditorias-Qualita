import { redirect } from "next/navigation";

import { contarLeads } from "@/lib/consola/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sidebar } from "./_components/Sidebar";

/** Shell de la consola: sidebar navy fijo + workspace claro.
 *
 *  El chequeo de sesión se repite acá aunque el proxy ya rebota a /login: el
 *  proxy es una comprobación optimista sobre la request y las server actions
 *  pueden esquivar su matcher. La autorización real vive del lado del
 *  servidor, en cada punto que lee datos. */

export const runtime = "nodejs";

const DOMINIO = "@qualita.studio";

export default async function ConsolaLayout({ children }: LayoutProps<"/app">) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email?.toLowerCase().endsWith(DOMINIO)) redirect("/login?error=dominio");

  // El badge del sidebar sale del mismo count real que usa el panel.
  const { nuevo } = await contarLeads();

  // La foto de Google viaja en el user_metadata de la sesión. El nombre de la
  // clave cambió con el tiempo según el provider, así que se aceptan las dos.
  const meta = user.user_metadata as { avatar_url?: unknown; picture?: unknown } | null;
  const foto =
    typeof meta?.avatar_url === "string"
      ? meta.avatar_url
      : typeof meta?.picture === "string"
        ? meta.picture
        : null;

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[250px_1fr]">
      <Sidebar email={user.email} foto={foto} nuevos={nuevo} />
      <div className="flex min-w-0 flex-col bg-bg">
        <div className="w-full max-w-[1240px] px-[clamp(18px,3vw,30px)] py-[clamp(20px,3vw,30px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
