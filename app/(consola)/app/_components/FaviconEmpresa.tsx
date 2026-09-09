"use client";

import { useState } from "react";

import { gradienteAvatar, iniciales } from "@/lib/consola/leads";

/** Ícono de la empresa: el favicon real de su sitio, con las iniciales como
 *  red de contención.
 *
 *  Es client por el `onError`: no hay forma de saber desde el servidor si
 *  Google tiene el favicon de ese dominio. Cae a las iniciales cuando la
 *  empresa no informó sitio, cuando el dominio no es parseable o cuando la
 *  imagen no carga. Nunca queda un ícono roto.
 *
 *  El ícono lo sirve Google (s2/favicons). Es la única llamada externa de la
 *  consola: sale del browser del equipo y lo único que viaja es el dominio
 *  público de la empresa. */

export function FaviconEmpresa({
  website,
  nombre,
  size = 38,
}: {
  website: string | null;
  nombre: string;
  size?: number;
}) {
  const dominio = dominioDe(website);
  const [fallo, setFallo] = useState(false);

  if (!dominio || fallo) {
    return (
      <span
        aria-hidden="true"
        className="flex flex-none items-center justify-center rounded-[10px] font-bold text-white"
        style={{
          width: size,
          height: size,
          fontSize: size > 34 ? "0.82rem" : "0.74rem",
          background: gradienteAvatar(nombre),
        }}
      >
        {iniciales(nombre)}
      </span>
    );
  }

  return (
    // next/image pediría remotePatterns en next.config para google.com, y
    // optimizar un ícono de 64px no aporta nada. Un <img> con onError es más
    // simple y más honesto.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=64`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFallo(true)}
      className="flex-none rounded-[10px] border border-linea bg-white object-contain p-1"
      style={{ width: size, height: size }}
    />
  );
}

/** Tolerante con lo que cargó la empresa: "qualita.studio", "www.qualita.studio",
 *  "https://qualita.studio/contacto" y hasta un espacio de más tienen que
 *  resolver al mismo dominio. */
function dominioDe(website: string | null): string | null {
  const crudo = website?.trim();
  if (!crudo) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`);
    const host = url.hostname.replace(/^www\./i, "");
    // Un host sin punto no es un dominio: no le pidamos el favicon a Google.
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}
