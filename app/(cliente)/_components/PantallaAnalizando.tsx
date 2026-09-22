"use client";

import {
  PASOS_ANALISIS as PASOS,
  calcularProgreso,
  formatearTiempo,
  useSegundosAnalizando,
  type EstadoAnalisis,
} from "@/lib/diagnostico/progreso";
import { Auras } from "./Auras";

/** Pantalla de espera del análisis. La comparten `/analizando/[id]` (después
 *  del submit, con polling) y `/d/[token]` (cuando el informe todavía está en
 *  pending o analyzing), para que sea el mismo diseño en los dos lados.
 *
 *  Los pasos y el cálculo del avance viven en lib/diagnostico/progreso.ts
 *  (ahí está qué es real y qué es estimado); la consola usa los mismos. */

export function PantallaAnalizando({
  status = "analyzing",
  transcurridoMs = null,
  listo = false,
  pie,
}: {
  status?: EstadoAnalisis;
  /** Cuánto llevaba en 'analyzing' según el servidor, al momento de la consulta. */
  transcurridoMs?: number | null;
  /** El análisis terminó: completa todo antes de redirigir. */
  listo?: boolean;
  pie?: React.ReactNode;
}) {
  const segundos = useSegundosAnalizando(status, transcurridoMs, listo);
  const { activo, porcentaje: progreso, enFila, pasado } = calcularProgreso(
    status,
    segundos,
    listo,
  );
  const pasoActual = activo >= 0 && activo < PASOS.length ? PASOS[activo] : null;

  return (
    <section className="relative flex flex-1 items-center overflow-hidden bg-dark text-white">
      <Auras />

      <div className="relative z-10 mx-auto grid w-full max-w-[1040px] items-center gap-10 px-[clamp(18px,5vw,32px)] py-20 md:grid-cols-[1fr_minmax(0,460px)] md:gap-14">
        <div>
          <span
            aria-hidden="true"
            className={`inline-block font-display text-[2.2rem] leading-[0.7] font-bold text-white ${
              listo ? "" : "motion-safe:animate-[spin_6s_linear_infinite]"
            }`}
          >
            *
          </span>

          <h1 className="mt-3.5 max-w-[16ch] text-[clamp(1.8rem,4.5vw,2.7rem)] font-bold text-white">
            {listo ? "Tu diagnóstico está listo" : "Estamos analizando tu presencia digital"}
          </h1>
          <p className="mt-2.5 max-w-[44ch] text-white/65">
            {listo
              ? "Te llevamos al informe en un segundo."
              : enFila
                ? "Tu análisis está en la fila y arranca en unos segundos. Podés cerrar la pestaña: te avisamos por mail cuando esté listo."
                : "Esto tarda entre 10 y 15 minutos: buscamos cómo te encuentran en Google y qué hace tu competencia. Podés cerrar la pestaña: te avisamos por mail cuando esté listo."}
          </p>

          {pie && <div className="mt-9 text-[0.78rem] text-white/35">{pie}</div>}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <span className="font-display text-[2.4rem] leading-none font-semibold tabular-nums">
              {Math.round(progreso)}
              <span className="text-[1.1rem] text-white/50">%</span>
            </span>
            <span className="pb-1 text-[0.82rem] text-white/45 tabular-nums">
              {enFila ? "En la fila" : formatearTiempo(segundos)}
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Avance del análisis"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progreso)}
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${progreso}%`, background: "var(--grad)" }}
            />
          </div>

          {/* Anuncia el paso nuevo a lectores de pantalla, sin el tick del reloj. */}
          <p className="sr-only" aria-live="polite">
            {listo ? "Análisis terminado" : (pasoActual?.titulo ?? "Análisis en la fila")}
          </p>

          <ol className="mt-6">
            {PASOS.map((paso, i) => {
              const estado = i < activo ? "hecho" : i === activo ? "activo" : "espera";
              return (
                <li
                  key={paso.titulo}
                  className={`flex gap-3.5 border-b border-white/[0.08] py-3 last:border-b-0 transition-opacity duration-500 ${
                    estado === "espera" ? "opacity-35" : "opacity-100"
                  }`}
                >
                  <IconoPaso estado={estado} />
                  <div className="min-w-0">
                    <span
                      className={`block text-[0.95rem] ${
                        estado === "activo" ? "font-semibold text-white" : "font-medium text-white/85"
                      }`}
                    >
                      {paso.titulo}
                    </span>
                    <div
                      className={`grid transition-[grid-template-rows] duration-500 ${
                        estado === "activo" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <span className="overflow-hidden text-[0.82rem] leading-snug text-white/55">
                        <span className="block pt-1">
                          {pasado && i === PASOS.length - 1
                            ? "Ya casi: estamos terminando los últimos detalles."
                            : paso.detalle}
                        </span>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function IconoPaso({ estado }: { estado: "hecho" | "activo" | "espera" }) {
  if (estado === "hecho") {
    return (
      <span
        aria-hidden="true"
        className="mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full"
        style={{ background: "var(--grad)" }}
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (estado === "activo") {
    return (
      <span aria-hidden="true" className="relative mt-px h-[22px] w-[22px] flex-none">
        <span className="absolute inset-0 rounded-full border-2 border-white/15" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-coral border-r-magenta" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="mt-px h-[22px] w-[22px] flex-none rounded-full border-2 border-white/30"
    />
  );
}
