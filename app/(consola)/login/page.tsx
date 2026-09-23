import type { Metadata } from "next";
import Image from "next/image";

import { BotonGoogle } from "./BotonGoogle";

/** Puerta de la consola interna. Sobria a propósito: es una pantalla para el
 *  equipo, no una landing. Sin auras ni asterisco, que son de la vista empresa. */

export const metadata: Metadata = {
  title: "Ingresar — Consola Qualita",
  description: "Acceso al panel interno de Qualita Studio.",
  robots: { index: false, follow: false },
};

const MENSAJES: Record<string, string> = {
  dominio: "Acceso solo para el equipo de Qualita.",
  oauth: "No pudimos completar el ingreso. Probá de nuevo.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const mensaje = typeof error === "string" ? MENSAJES[error] : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-6 py-16">
      <div className="w-full max-w-[380px]">
        <div className="rounded-card border border-linea bg-card p-8 shadow-qualita">
          <Image
            src="/Logo-nuevo.png"
            alt="Qualita Studio"
            width={1140}
            height={299}
            priority
            className="h-8 w-auto"
          />

          <p className="mt-7 flex items-center gap-2 text-[0.68rem] font-semibold tracking-[0.2em] text-magenta uppercase">
            <span aria-hidden="true" className="block h-px w-5 bg-coral" />
            Consola interna
          </p>
          <h1 className="mt-3 text-[1.5rem] font-semibold text-navy">Ingresar</h1>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-tinta">
            Panel de leads y diagnósticos. Entrá con tu cuenta de{" "}
            <span className="font-semibold text-navy">@qualita.studio</span>.
          </p>

          {mensaje ? (
            <p
              role="alert"
              className="mt-6 rounded-campo border border-warn/25 bg-warnbg px-4 py-3 text-[0.85rem] font-medium text-warn"
            >
              {mensaje}
            </p>
          ) : null}

          <div className="mt-7">
            <BotonGoogle />
          </div>
        </div>

        <p className="mt-5 text-center text-[0.78rem] text-tinta2">
          ¿Buscabas tu diagnóstico? Está en el link que te compartimos.
        </p>
      </div>
    </main>
  );
}
