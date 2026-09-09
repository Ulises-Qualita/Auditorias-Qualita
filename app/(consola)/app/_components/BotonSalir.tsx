"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** signOut() desde el browser borra las cookies de sesión; el refresh() tira
 *  abajo el caché del router para que no quede pintada la consola de la
 *  sesión anterior. */

export function BotonSalir() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="w-full rounded-[10px] border border-white/15 px-3 py-2 text-[0.8rem] font-medium text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-60"
    >
      {saliendo ? "Saliendo…" : "Salir"}
    </button>
  );
}
