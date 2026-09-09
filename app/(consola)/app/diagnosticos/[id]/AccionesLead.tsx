"use client";

import { useState, useTransition } from "react";

import { ESTADOS_LEAD, ESTADO_LEAD, type EstadoLead } from "@/lib/consola/leads";
import { cambiarEstadoLead, marcarRevisado } from "./actions";

/** Los dos controles de escritura de la consola.
 *
 *  Optimista de verdad: el estado se pinta apenas se clickea y vuelve atrás si
 *  la action falla. `useTransition` mantiene la UI viva mientras el servidor
 *  revalida, y el error se muestra en pantalla en vez de morir en la consola
 *  del browser. */

export function AccionesLead({
  diagnosticId,
  estadoActual,
  status,
  reviewedBy,
}: {
  diagnosticId: string;
  estadoActual: EstadoLead | null;
  status: string;
  reviewedBy: string | null;
}) {
  const [pendiente, startTransition] = useTransition();
  const [estado, setEstado] = useState<EstadoLead | null>(estadoActual);
  const [error, setError] = useState<string | null>(null);

  function elegir(nuevo: EstadoLead) {
    if (nuevo === estado || pendiente) return;

    const previo = estado;
    setEstado(nuevo);
    setError(null);

    startTransition(async () => {
      const res = await cambiarEstadoLead(diagnosticId, nuevo);
      if (!res.ok) {
        setEstado(previo);
        setError(res.error);
      }
    });
  }

  function revisar() {
    setError(null);
    startTransition(async () => {
      const res = await marcarRevisado(diagnosticId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="rounded-card border border-linea bg-card p-5 shadow-qualita">
      <p className="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] text-magenta uppercase">
        <span aria-hidden="true" className="block h-px w-4 bg-coral" />
        Estado del lead
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ESTADOS_LEAD.map((e) => {
          const activo = e === estado;
          return (
            <button
              key={e}
              type="button"
              onClick={() => elegir(e)}
              disabled={pendiente}
              aria-pressed={activo}
              className={`rounded-full border px-3 py-1.5 text-[0.76rem] font-semibold transition disabled:opacity-60 ${
                activo
                  ? "border-navy bg-navy text-white"
                  : "border-linea text-tinta hover:border-tinta2"
              }`}
            >
              {ESTADO_LEAD[e].label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-linea2 pt-4">
        <p className="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] text-magenta uppercase">
          <span aria-hidden="true" className="block h-px w-4 bg-coral" />
          Revisión
        </p>

        {status === "sent" ? (
          <p className="mt-3 text-[0.85rem] text-tinta">
            Revisado y publicado como oficial
            {reviewedBy ? (
              <>
                {" "}
                por <span className="font-semibold text-navy">{reviewedBy}</span>
              </>
            ) : null}
            .
          </p>
        ) : status === "preliminary" ? (
          <>
            <p className="mt-3 text-[0.85rem] text-tinta">
              El informe está en preliminar. Al marcarlo revisado pasa a oficial y queda tu email
              registrado.
            </p>
            <button
              type="button"
              onClick={revisar}
              disabled={pendiente}
              className="mt-3 w-full rounded-full px-4 py-2.5 text-[0.86rem] font-semibold text-white transition disabled:opacity-60"
              style={{ background: "var(--grad)" }}
            >
              {pendiente ? "Guardando…" : "Marcar revisado"}
            </button>
          </>
        ) : (
          <p className="mt-3 text-[0.85rem] text-tinta">
            El análisis todavía no terminó: no hay nada que revisar.
          </p>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-campo border border-warn/25 bg-warnbg px-3 py-2 text-[0.8rem] font-medium text-warn"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
