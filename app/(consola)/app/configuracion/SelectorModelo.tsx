"use client";

import { useState, useTransition } from "react";

import { PRECIOS } from "@/lib/analysis/costo";
import { MODELOS } from "@/lib/analysis/modelos";
import { guardarModelo } from "./actions";

/** Elegir el modelo de las próximas auditorías. Se guarda con un botón y no
 *  al clickear: cambia lo que se gasta en cada análisis, así que el cambio
 *  tiene que ser deliberado. */
export function SelectorModelo({ actual }: { actual: string | null }) {
  const [pendiente, startTransition] = useTransition();
  const [elegido, setElegido] = useState<string | null>(actual);
  const [guardado, setGuardado] = useState<string | null>(actual);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const sinCambios = elegido === guardado;

  function guardar() {
    if (!elegido || sinCambios) return;
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const res = await guardarModelo(elegido);
      if (res.ok) {
        setGuardado(elegido);
        const nombre = MODELOS.find((m) => m.id === elegido)?.nombre ?? elegido;
        setAviso(`Guardado. Las próximas auditorías usan ${nombre}.`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Modelo de análisis</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODELOS.map((m) => {
            const activo = m.id === elegido;
            const precio = PRECIOS[m.id];
            return (
              <label
                key={m.id}
                className={`cursor-pointer rounded-campo border p-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-magenta/40 ${
                  activo ? "border-navy bg-bg" : "border-linea hover:border-tinta2"
                }`}
              >
                <input
                  type="radio"
                  name="modelo"
                  value={m.id}
                  checked={activo}
                  onChange={() => setElegido(m.id)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-navy">{m.nombre}</span>
                  {m.id === guardado ? (
                    <span className="rounded-full bg-okbg px-2 py-0.5 text-[0.68rem] font-bold text-ok">
                      En uso
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-[0.8rem] text-tinta">{m.desc}</span>
                {precio ? (
                  <span className="mt-2 block text-[0.74rem] text-tinta2">
                    ${precio.input} entrada · ${precio.output} salida, por millón de tokens
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-linea2 pt-4">
        <button
          type="button"
          onClick={guardar}
          disabled={!elegido || sinCambios || pendiente}
          className="rounded-full px-5 py-2.5 text-[0.88rem] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: "var(--grad)" }}
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <p className="text-[0.8rem] text-tinta2">
          Las auditorías que ya corrieron conservan el modelo con el que se hicieron.
        </p>
      </div>

      {aviso ? (
        <p className="mt-4 rounded-campo border border-ok/25 bg-okbg px-3 py-2 text-[0.8rem] font-medium text-ok">
          {aviso}
        </p>
      ) : null}

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
