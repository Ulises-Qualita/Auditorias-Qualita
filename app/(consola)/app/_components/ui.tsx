import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  ESTADO_ANALISIS,
  ESTADO_LEAD,
  colorScore,
  gradienteAvatar,
  iniciales,
  type EstadoLead,
} from "@/lib/consola/leads";

/** Piezas de presentación de la consola. Son server-safe (sin hooks ni
 *  handlers) para que las páginas sigan siendo server components y el fetch
 *  no se corra al browser. Los tokens salen de globals.css; nada de paleta
 *  nueva. */

export function Tile({
  label,
  valor,
  sufijo,
  nota,
  color,
}: {
  label: string;
  valor: string | number;
  sufijo?: string;
  nota?: string;
  color: string;
}) {
  return (
    <div className="rounded-card border border-linea bg-card p-5 shadow-qualita">
      <div className="flex items-center gap-2 text-[0.8rem] font-medium text-tinta">
        <span
          aria-hidden="true"
          className="block size-2.5 rounded-full"
          style={{ background: color }}
        />
        {label}
      </div>
      <div className="mt-3 font-display text-[1.9rem] leading-none font-bold text-navy">
        {valor}
        {sufijo ? <span className="text-[1rem] font-medium text-tinta">{sufijo}</span> : null}
      </div>
      {nota ? <div className="mt-2 text-[0.76rem] font-medium text-tinta">{nota}</div> : null}
    </div>
  );
}

export function Panel({
  titulo,
  desc,
  extra,
  children,
}: {
  titulo: string;
  desc?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-linea bg-card p-6 shadow-qualita">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-sans text-[1rem] font-bold text-navy">{titulo}</h3>
          {desc ? <p className="mt-0.5 text-[0.82rem] text-tinta">{desc}</p> : null}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Estado vacío: se usa cuando todavía no hay datos suficientes. Preferimos
 *  esto antes que un gráfico en cero, que se lee como un error. */
export function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-campo border border-dashed border-linea bg-bg px-4 py-8 text-center text-[0.85rem] text-tinta">
      {children}
    </p>
  );
}

export function PillLead({ estado }: { estado: EstadoLead | null }) {
  const info = estado ? ESTADO_LEAD[estado] : null;
  if (!info) return <span className="text-[0.8rem] text-tinta2">—</span>;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.74rem] font-bold whitespace-nowrap ${info.pill}`}
    >
      <span aria-hidden="true" className={`block size-[7px] rounded-full ${info.punto}`} />
      {info.label}
    </span>
  );
}

export function PillAnalisis({ status }: { status: string }) {
  const info = ESTADO_ANALISIS[status] ?? { label: status, clase: "bg-bg text-tinta2" };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[0.7rem] font-bold whitespace-nowrap ${info.clase}`}
    >
      {info.label}
    </span>
  );
}

/** Score con barrita. Sin número no hay barra: un 0 mentiría sobre un
 *  diagnóstico que todavía no terminó. */
export function BarraScore({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-[0.8rem] text-tinta2">Sin puntuar</span>;
  }

  return (
    <div className="flex items-center gap-2.5">
      <b
        className="w-7 font-display text-[0.95rem] font-bold"
        style={{ color: colorScore(score) }}
      >
        {score}
      </b>
      <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-linea2">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: "var(--grad)" }}
        />
      </span>
    </div>
  );
}

export function Avatar({ nombre, size = 38 }: { nombre: string; size?: number }) {
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

/** Barra de una fila de ranking (rubros, madurez por canal). */
export function BarraRanking({
  label,
  valor,
  porcentaje,
  anchoLabel = "w-40",
}: {
  label: string;
  valor: string;
  porcentaje: number;
  anchoLabel?: string;
}) {
  return (
    <div className="mb-3.5 flex items-center gap-3 last:mb-0">
      <span className={`${anchoLabel} flex-none truncate text-[0.85rem] text-navy`}>{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-linea2">
        <span
          className="block h-full rounded-full"
          style={{ width: `${porcentaje}%`, background: "var(--grad)" }}
        />
      </span>
      <span className="w-9 text-right text-[0.82rem] font-bold text-tinta">{valor}</span>
    </div>
  );
}

export function CabeceraPagina({
  titulo,
  desc,
  accion,
}: {
  titulo: string;
  desc?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.5rem] font-bold text-navy">{titulo}</h1>
        {desc ? <p className="mt-1.5 max-w-[60ch] text-[0.92rem] text-tinta">{desc}</p> : null}
      </div>
      {accion}
    </div>
  );
}

export function BotonSecundario({ href, children }: { href: Route; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-linea bg-white px-4 py-2 text-[0.85rem] font-semibold text-navy transition hover:border-tinta2"
    >
      {children}
    </Link>
  );
}
