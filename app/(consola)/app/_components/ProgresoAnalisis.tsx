"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MINUTOS_COLGADO } from "@/lib/consola/reintento";
import {
  PASOS_ANALISIS as PASOS,
  calcularProgreso,
  formatearTiempo,
  useSegundosAnalizando,
  type EstadoAnalisis,
} from "@/lib/diagnostico/progreso";

/** Avance del análisis en el detalle de la consola, mientras el diagnóstico
 *  está en pending o analyzing. Mismos pasos y mismo cálculo que la pantalla
 *  del cliente (lib/diagnostico/progreso.ts), con el tono del workspace:
 *  claro, denso y con los nombres técnicos de cada parte del pipeline.
 *
 *  Consulta /api/diagnostics/[id]/status y, cuando el análisis termina (bien o
 *  mal), refresca la ruta: el server component vuelve a leer la fila y dibuja
 *  el informe o el error, y este componente desaparece solo. */

const INTERVALO_MS = 3000;

export function ProgresoAnalisis({
  diagnosticId,
  statusInicial,
}: {
  diagnosticId: string;
  statusInicial: EstadoAnalisis;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<EstadoAnalisis>(statusInicial);
  const [transcurridoMs, setTranscurridoMs] = useState<number | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();
    let intervalo: ReturnType<typeof setInterval> | null = null;
    let terminado = false;

    function frenar() {
      if (intervalo !== null) {
        clearInterval(intervalo);
        intervalo = null;
      }
    }

    async function consultar() {
      if (terminado) return;

      let cuerpo: { status?: string; transcurridoMs?: number | null } | null = null;
      try {
        const respuesta = await fetch(`/api/diagnostics/${diagnosticId}/status`, {
          cache: "no-store",
          signal: controlador.signal,
        });
        if (!respuesta.ok) return;
        cuerpo = await respuesta.json();
      } catch {
        return;
      }
      if (terminado || !cuerpo) return;

      if (cuerpo.status === "pending" || cuerpo.status === "analyzing") {
        setStatus(cuerpo.status);
        setTranscurridoMs(cuerpo.transcurridoMs ?? null);
        return;
      }

      // preliminary, sent o failed: la página tiene algo nuevo que mostrar.
      terminado = true;
      frenar();
      if (cuerpo.status !== "failed") setListo(true);
      router.refresh();
    }

    function arrancar() {
      if (terminado || intervalo !== null) return;
      intervalo = setInterval(consultar, INTERVALO_MS);
    }

    function alCambiarVisibilidad() {
      if (document.hidden) {
        frenar();
      } else {
        void consultar();
        arrancar();
      }
    }

    void consultar();
    arrancar();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      terminado = true;
      frenar();
      controlador.abort();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [diagnosticId, router]);

  const segundos = useSegundosAnalizando(status, transcurridoMs, listo);
  const { activo, porcentaje, enFila, pasado } = calcularProgreso(status, segundos, listo);
  const colgado = status === "analyzing" && segundos >= MINUTOS_COLGADO * 60;

  // Al cruzar el umbral de colgado, el botón de reintento lo decide el
  // servidor (motivoReintento): un refresh lo hace aparecer en el panel.
  const avisoColgado = useRef(false);
  useEffect(() => {
    if (colgado && !avisoColgado.current) {
      avisoColgado.current = true;
      router.refresh();
    }
  }, [colgado, router]);

  return (
    <section className="rounded-card border border-linea bg-card p-6 shadow-qualita">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-sans text-[1rem] font-bold text-navy">
          {listo
            ? "Análisis terminado"
            : enFila
              ? "En la fila de análisis"
              : "Análisis en curso"}
        </h2>
        <span className="text-[0.8rem] text-tinta2 tabular-nums">
          {enFila ? "esperando que arranque" : formatearTiempo(segundos)}
          <span className="mx-1.5 text-linea">·</span>
          <b className="font-semibold text-navy">{Math.round(porcentaje)}%</b>
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Avance del análisis"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(porcentaje)}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-linea2"
      >
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${porcentaje}%`, background: "var(--grad)" }}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {listo
          ? "Análisis terminado"
          : activo >= 0 && activo < PASOS.length
            ? PASOS[activo].interno
            : "En la fila"}
      </p>

      <ol className="mt-5 grid gap-x-6 sm:grid-cols-2">
        {PASOS.map((paso, i) => {
          const estado = i < activo ? "hecho" : i === activo ? "activo" : "espera";
          return (
            <li
              key={paso.interno}
              className={`flex items-center gap-2.5 border-b border-linea2 py-2 text-[0.85rem] transition-colors ${
                estado === "activo"
                  ? "font-semibold text-navy"
                  : estado === "hecho"
                    ? "text-tinta"
                    : "text-tinta2"
              }`}
            >
              <IconoPaso estado={estado} />
              <span className="min-w-0 truncate">{paso.interno}</span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[0.76rem] text-tinta2">
        {colgado
          ? `Lleva más de ${MINUTOS_COLGADO} minutos: probablemente quedó colgado. Podés reintentarlo desde el panel.`
          : pasado
            ? "Pasó el tiempo típico de una corrida; puede estar en un reintento de Inngest."
            : "El estado es real; el paso en curso es una estimación según la duración típica de una corrida."}
      </p>
    </section>
  );
}

function IconoPaso({ estado }: { estado: "hecho" | "activo" | "espera" }) {
  if (estado === "hecho") {
    return (
      <span
        aria-hidden="true"
        className="flex size-[18px] flex-none items-center justify-center rounded-full bg-okbg text-ok"
      >
        <svg viewBox="0 0 16 16" className="size-2.5" fill="none">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (estado === "activo") {
    return (
      <span aria-hidden="true" className="relative size-[18px] flex-none">
        <span className="absolute inset-0 rounded-full border-2 border-linea" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-magenta" />
      </span>
    );
  }

  return (
    <span aria-hidden="true" className="size-[18px] flex-none rounded-full border-2 border-linea" />
  );
}
