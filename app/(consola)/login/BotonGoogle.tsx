"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** El OAuth arranca en el browser: signInWithOAuth necesita redirigir la
 *  ventana, así que este es el único pedazo cliente del login.
 *
 *  `hd` le pide a Google que muestre directo el selector del dominio y
 *  `select_account` evita quedar pegado a la cuenta personal de quien tenga
 *  varias sesiones abiertas. Ninguna de las dos es una garantía de seguridad:
 *  eso lo resuelven el client Internal y la verificación del callback. */

export function BotonGoogle() {
  const [enviando, setEnviando] = useState(false);

  async function ingresar() {
    setEnviando(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: { hd: "qualita.studio", prompt: "select_account" },
      },
    });

    // Si salió bien el browser ya se está yendo a Google; solo importa
    // recuperar el botón cuando falla.
    if (error) setEnviando(false);
  }

  return (
    <button
      type="button"
      onClick={ingresar}
      disabled={enviando}
      className="flex w-full items-center justify-center gap-3 rounded-campo border border-linea bg-white px-5 py-3.5 text-[0.94rem] font-semibold text-navy shadow-qualita transition hover:border-tinta2 hover:shadow-qualita-lg disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogoGoogle />
      {enviando ? "Redirigiendo…" : "Ingresar con Google"}
    </button>
  );
}

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
