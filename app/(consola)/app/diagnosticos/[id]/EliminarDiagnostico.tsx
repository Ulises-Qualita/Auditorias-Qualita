"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { eliminarDiagnostico } from "./actions";

/** Borrar un diagnóstico. Confirmación en dos pasos dentro de la tarjeta, sin
 *  window.confirm: es irreversible, así que el segundo click dice qué se
 *  pierde. */
export function EliminarDiagnostico({
  diagnosticId,
  volverA,
}: {
  diagnosticId: string;
  /** El listado al que se vuelve después de borrar. */
  volverA: Route;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function eliminar() {
    setError(null);
    startTransition(async () => {
      const res = await eliminarDiagnostico(diagnosticId);
      if (res.ok) {
        router.push(volverA);
      } else {
        setError(res.error);
        setConfirmando(false);
      }
    });
  }

  return (
    <div className="rounded-card border border-linea bg-card p-5 shadow-qualita">
      <p className="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] text-magenta uppercase">
        <span aria-hidden="true" className="block h-px w-4 bg-coral" />
        Eliminar
      </p>

      {confirmando ? (
        <>
          <p className="mt-3 text-[0.85rem] text-tinta">
            Se borran el diagnóstico, el link del informe y los datos de la empresa. No se puede
            deshacer.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pendiente}
              className="flex-1 rounded-full border border-linea bg-white px-4 py-2.5 text-[0.86rem] font-semibold text-navy transition hover:border-tinta2 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={eliminar}
              disabled={pendiente}
              className="flex-1 rounded-full bg-warn px-4 py-2.5 text-[0.86rem] font-semibold text-white transition disabled:opacity-60"
            >
              {pendiente ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-3 w-full rounded-full border border-warn/40 bg-white px-4 py-2.5 text-[0.86rem] font-semibold text-warn transition hover:bg-warnbg"
        >
          Eliminar diagnóstico
        </button>
      )}

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
