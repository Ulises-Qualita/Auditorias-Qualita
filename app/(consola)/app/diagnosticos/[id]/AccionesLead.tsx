"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { ESTADOS_LEAD, ESTADO_LEAD, type EstadoLead } from "@/lib/consola/leads";
import { MINUTOS_COLGADO, type MotivoReintento } from "@/lib/consola/reintento";
import { cambiarEstadoLead, marcarRevisado, reintentarAnalisis } from "./actions";

/** Los controles de escritura de la consola.
 *
 *  Optimista de verdad: el estado se pinta apenas se clickea y vuelve atrás si
 *  la action falla. `useTransition` mantiene la UI viva mientras el servidor
 *  revalida, y el error se muestra en pantalla en vez de morir en la consola
 *  del browser. */

const EN_CURSO = ["pending", "analyzing"];

export function AccionesLead({
  diagnosticId,
  estadoActual,
  status,
  reviewedBy,
  motivo,
  mostrarEstadoLead = true,
}: {
  diagnosticId: string;
  estadoActual: EstadoLead | null;
  status: string;
  reviewedBy: string | null;
  /** Null = no se puede reintentar (ya terminó, o hay un intento en curso).
   *  Lo decide el servidor con motivoReintento(); acá solo se dibuja. */
  motivo: MotivoReintento | null;
  /** Los diagnósticos internos no son leads: conservan revisar y reintentar,
   *  pero no el selector de estado. */
  mostrarEstadoLead?: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [estado, setEstado] = useState<EstadoLead | null>(estadoActual);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enCurso = EN_CURSO.includes(status);

  // Esta es una página de servidor: sin esto, un análisis que arranca en
  // 'pending' y termina en 'preliminary' 30 segundos después se queda
  // mostrando "En cola" hasta que alguien recargue —justo la pantalla que
  // hizo falta depurar a mano—. Rápido al principio, porque el caso normal
  // termina en ~30s, y después espaciado hasta pasar el umbral de colgado,
  // que es cuando aparece el botón de reintentar sin recargar nada.
  useEffect(() => {
    if (!enCurso) return;

    const desde = Date.now();
    const tope = (MINUTOS_COLGADO + 1) * 60_000;
    let timer: ReturnType<typeof setTimeout>;

    function programar() {
      const transcurrido = Date.now() - desde;
      if (transcurrido > tope) return;
      timer = setTimeout(
        () => {
          router.refresh();
          programar();
        },
        transcurrido < 60_000 ? 5_000 : 30_000,
      );
    }

    programar();
    return () => clearTimeout(timer);
  }, [enCurso, router]);

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

  function reintentar() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const res = await reintentarAnalisis(diagnosticId);
      if (res.ok) setAviso("Análisis reencolado. La pantalla se actualiza sola.");
      else setError(res.error);
    });
  }

  return (
    // El primer bloque visible no lleva el separador de arriba: sin el de
    // estado del lead, "Análisis" o "Revisión" pasan a ser los primeros.
    <div className="rounded-card border border-linea bg-card p-5 shadow-qualita [&>div:first-child]:mt-0 [&>div:first-child]:border-t-0 [&>div:first-child]:pt-0">
      {mostrarEstadoLead ? (
        <div>
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
        </div>
      ) : null}

      {motivo || enCurso ? (
        <div className="mt-5 border-t border-linea2 pt-4">
          <p className="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] text-magenta uppercase">
            <span aria-hidden="true" className="block h-px w-4 bg-coral" />
            Análisis
          </p>

          <p className="mt-3 text-[0.85rem] text-tinta">
            {motivo === "failed"
              ? "El análisis falló. Podés volver a encolarlo: se descarta el error y se corre de nuevo."
              : motivo === "colgado"
                ? `Hace más de ${MINUTOS_COLGADO} minutos que no da señales. Lo más probable es que el evento nunca se haya encolado.`
                : "El análisis está corriendo. Esta pantalla se actualiza sola."}
          </p>

          {motivo ? (
            <button
              type="button"
              onClick={reintentar}
              disabled={pendiente}
              className="mt-3 w-full rounded-full border border-linea bg-white px-4 py-2.5 text-[0.86rem] font-semibold text-navy transition hover:border-tinta2 disabled:opacity-60"
            >
              {pendiente ? "Reencolando…" : "Reintentar análisis"}
            </button>
          ) : null}
        </div>
      ) : null}

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
