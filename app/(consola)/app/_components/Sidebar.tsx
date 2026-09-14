"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AvatarUsuario } from "./AvatarUsuario";
import { BotonSalir } from "./BotonSalir";

/** Navegación de la consola. Es client solo por `usePathname` (marcar el ítem
 *  activo); los datos que muestra —el badge de nuevos, el email— llegan como
 *  props desde el layout, que los lee en el servidor. */

type Item = { href: Route; label: string; icono: ReactNode; badge?: number };

export function Sidebar({
  email,
  foto,
  nuevos,
}: {
  email: string;
  foto: string | null;
  nuevos: number;
}) {
  const pathname = usePathname();

  const trabajo: Item[] = [
    { href: "/app", label: "Panel", icono: <IconoPanel /> },
    {
      href: "/app/diagnosticos",
      label: "Autodiagnósticos",
      icono: <IconoLeads />,
      badge: nuevos,
    },
    { href: "/app/internos", label: "Diagnósticos internos", icono: <IconoInternos /> },
    { href: "/app/competencia", label: "Competencia", icono: <IconoCompetencia /> },
  ];

  const cuenta: Item[] = [
    { href: "/app/configuracion", label: "Configuración", icono: <IconoConfig /> },
  ];

  /** `/app` solo está activo en su propia ruta; el resto matchea el prefijo
   *  para que el detalle de un diagnóstico siga iluminando la sección. */
  const activo = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <aside className="flex flex-col bg-sidebar px-3.5 py-5 text-white md:sticky md:top-0 md:h-dvh">
      <Link href="/app" className="flex items-center gap-3 px-2 pt-1.5 pb-5">
        <Image
          src="/qualita-logo-blanco.svg"
          alt="Qualita Studio"
          width={277}
          height={114}
          priority
          className="h-10 w-auto"
        />
      </Link>

      <p className="px-2.5 pt-2 pb-2 text-[0.64rem] font-bold tracking-[0.16em] text-white/35 uppercase">
        Trabajo
      </p>
      {trabajo.map((item) => (
        <ItemNav key={item.href} item={item} activo={activo(item.href)} />
      ))}

      <p className="px-2.5 pt-4 pb-2 text-[0.64rem] font-bold tracking-[0.16em] text-white/35 uppercase">
        Cuenta
      </p>
      {cuenta.map((item) => (
        <ItemNav key={item.href} item={item} activo={activo(item.href)} />
      ))}

      <div className="mt-auto border-t border-white/10 pt-3.5">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <AvatarUsuario email={email} foto={foto} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.82rem] font-semibold" title={email}>
              {email}
            </span>
            <span className="block text-[0.72rem] text-white/50">Equipo Qualita</span>
          </span>
        </div>
        <div className="px-2 pt-1">
          <BotonSalir />
        </div>
      </div>
    </aside>
  );
}

function ItemNav({ item, activo }: { item: Item; activo: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[0.9rem] font-medium transition ${
        activo ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      {activo ? (
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-3.5 h-5 w-1 -translate-y-1/2 rounded-r"
          style={{ background: "var(--grad)" }}
        />
      ) : null}
      <span className="flex-none [&>svg]:size-[18px]">{item.icono}</span>
      {item.label}
      {item.badge ? (
        <span className="ml-auto rounded-full bg-coral px-2 py-0.5 text-[0.66rem] font-bold text-white">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

/* Íconos del mockup: trazo, nunca emojis. */

function IconoPanel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconoLeads() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconoInternos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M12 12v6M9 15h6" />
    </svg>
  );
}

function IconoCompetencia() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

function IconoConfig() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.9 1.1V21a2 2 0 01-4 0v-.09A1.65 1.65 0 007.4 19a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 005 9.4a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9" />
    </svg>
  );
}
