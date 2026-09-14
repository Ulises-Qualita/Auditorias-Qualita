"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { eliminarDiagnostico } from "./actions";

/** Botón de papelera para una fila de las tablas de la consola, con modal de
 *  confirmación.
 *
 *  `<dialog>` nativo con showModal(): va al top layer, atrapa el foco y cierra
 *  con Escape sin código extra. `relative z-10` lo pone por encima del link
 *  estirado de la fila, así el click no navega al detalle. */
export function EliminarFila({ diagnosticId, nombre }: { diagnosticId: string; nombre: string }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setError(null);
    dialogo.current?.showModal();
  }

  function cerrar() {
    if (pendiente) return;
    dialogo.current?.close();
  }

  function eliminar() {
    setError(null);
    startTransition(async () => {
      const res = await eliminarDiagnostico(diagnosticId);
      if (res.ok) {
        dialogo.current?.close();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={`Eliminar el diagnóstico de ${nombre}`}
        title="Eliminar"
        className="relative z-10 grid size-8 place-items-center rounded-campo text-tinta2 transition hover:bg-warnbg hover:text-warn"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
        </svg>
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={`eliminar-${diagnosticId}`}
        onCancel={(e) => {
          // Escape mientras se borra: no cerrar a mitad de camino.
          if (pendiente) e.preventDefault();
        }}
        onClick={(e) => {
          // Click en el backdrop (fuera de la tarjeta) cierra.
          if (e.target === e.currentTarget) cerrar();
        }}
        className="m-auto w-[min(92vw,420px)] rounded-card border border-linea bg-card p-0 text-left shadow-qualita backdrop:bg-navy/40"
      >
        <div className="p-6">
          <h2
            id={`eliminar-${diagnosticId}`}
            className="font-display text-[1.05rem] font-semibold text-navy"
          >
            ¿Eliminar el diagnóstico de {nombre}?
          </h2>
          <p className="mt-2 text-[0.88rem] text-tinta">
            Se borran el diagnóstico, el link del informe y los datos de la empresa. No se puede
            deshacer.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-campo border border-warn/25 bg-warnbg px-3 py-2 text-[0.8rem] font-medium text-warn"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              disabled={pendiente}
              autoFocus
              className="rounded-full border border-linea bg-white px-4 py-2.5 text-[0.86rem] font-semibold text-navy transition hover:border-tinta2 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={eliminar}
              disabled={pendiente}
              className="rounded-full bg-warn px-4 py-2.5 text-[0.86rem] font-semibold text-white transition disabled:opacity-60"
            >
              {pendiente ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
