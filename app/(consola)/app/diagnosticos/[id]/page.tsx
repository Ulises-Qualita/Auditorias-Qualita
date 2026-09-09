import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AValidar, Fugas } from "@/app/(cliente)/d/[token]/CierreInforme";
import { Pilares } from "@/app/(cliente)/d/[token]/Pilares";
import { parseFallo, parseResultsInterno } from "@/lib/consola/facts";
import { ESTADO_LEAD, fechaRelativa } from "@/lib/consola/leads";
import { diagnosticoCompleto } from "@/lib/consola/queries";
import { nivelDeScore } from "@/lib/diagnostico/results";
import { FaviconEmpresa } from "../../_components/FaviconEmpresa";
import { BarraScore, BotonSecundario, PillAnalisis, PillLead, Vacio } from "../../_components/ui";
import { AccionesLead } from "./AccionesLead";
import { DatosTecnicos } from "./DatosTecnicos";

/** Detalle interno de un diagnóstico.
 *
 *  Es la misma información que ve el cliente en /d/[token] —los componentes
 *  del informe se reusan tal cual— más lo que el cliente no ve: los hechos
 *  crudos del colector, el error técnico cuando el análisis falló, y los
 *  controles para cambiar el estado del lead y aprobar el informe.
 *
 *  El hero del informe público NO se reusa: es oscuro, con auras y tono "vos",
 *  pensado para una sola pantalla del cliente. Acá la cabecera es densa
 *  porque el equipo necesita contacto, scores y estados de un vistazo. */

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Detalle — Consola Qualita",
  robots: { index: false, follow: false },
};

export default async function DetalleDiagnosticoPage({
  params,
}: PageProps<"/app/diagnosticos/[id]">) {
  const { id } = await params;
  const dg = await diagnosticoCompleto(id);

  if (!dg) notFound();

  const empresa = dg.empresa;
  const nombre = empresa?.name ?? "Empresa sin nombre";
  const results = parseResultsInterno(dg.results);
  const fallo = dg.status === "failed" ? parseFallo(dg.results) : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <BotonSecundario href="/app/diagnosticos">← Autodiagnósticos</BotonSecundario>
        {dg.token ? (
          <a
            href={`/d/${dg.token}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-linea bg-white px-4 py-2 text-[0.85rem] font-semibold text-navy transition hover:border-tinta2"
          >
            Ver informe del cliente
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        ) : null}
      </div>

      {results?.analysis_source === "mock" ? (
        <p className="mb-4 rounded-card bg-navy px-5 py-2.5 text-center text-[0.8rem] font-semibold text-white/85">
          Datos mock · este informe no es un diagnóstico real
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="min-w-0">
          {/* Cabecera */}
          <section className="rounded-card border border-linea bg-card p-6 shadow-qualita">
            <div className="flex flex-wrap items-start gap-4">
              <FaviconEmpresa website={empresa?.website ?? null} nombre={nombre} size={52} />
              <div className="min-w-0 flex-1">
                <h1 className="text-[1.25rem] font-bold text-navy">{nombre}</h1>
                <p className="mt-1 text-[0.85rem] text-tinta">
                  {[empresa?.industry, empresa?.province, fechaRelativa(dg.created_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {empresa?.website ? (
                  <a
                    href={normalizarUrl(empresa.website)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[0.84rem] font-medium text-magenta"
                  >
                    {empresa.website}
                  </a>
                ) : (
                  <p className="mt-1 text-[0.84rem] text-tinta2">Sin sitio informado</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PillAnalisis status={dg.status} />
                <PillLead estado={dg.lead_status} />
              </div>
            </div>

            <div className="mt-6 grid gap-6 border-t border-linea2 pt-5 sm:grid-cols-2">
              <div>
                <p className="text-[0.72rem] font-semibold tracking-[0.08em] text-tinta2 uppercase">
                  Contacto
                </p>
                <p className="mt-1.5 text-[0.92rem] font-semibold text-navy">
                  {empresa?.contact_name ?? "—"}
                </p>
                {empresa?.contact_email ? (
                  <a
                    href={`mailto:${empresa.contact_email}`}
                    className="text-[0.85rem] text-magenta"
                  >
                    {empresa.contact_email}
                  </a>
                ) : null}
              </div>

              <div className="flex gap-8">
                <Puntaje label="General" score={dg.score_general} destacado />
                <Puntaje label="Infraestructura" score={dg.score_infra} />
              </div>
            </div>

            <p className="mt-5 border-t border-linea2 pt-3 text-[0.76rem] text-tinta2">
              Método {dg.method_version ?? "?"}
              {dg.updated_at ? ` · última actualización ${fechaRelativa(dg.updated_at)}` : ""}
              {dg.lead_status ? ` · lead ${ESTADO_LEAD[dg.lead_status].label.toLowerCase()}` : ""}
            </p>
          </section>

          {/* Cuerpo */}
          {fallo ? (
            <section className="mt-4 rounded-card border border-warn/25 bg-warnbg p-6">
              <h2 className="font-sans text-[1rem] font-bold text-warn">El análisis falló</h2>
              <p className="mt-2 font-mono text-[0.82rem] break-words text-navy">{fallo.error}</p>
              {fallo.fallo_en ? (
                <p className="mt-2 text-[0.78rem] text-tinta">
                  {new Date(fallo.fallo_en).toLocaleString("es-AR")}
                </p>
              ) : null}
              <p className="mt-3 text-[0.82rem] text-tinta">
                El error se muestra completo porque esta es la vista interna. El cliente ve una
                pantalla sobria sin detalles técnicos.
              </p>
            </section>
          ) : results ? (
            <>
              <section className="mt-4 rounded-card border border-linea bg-card p-6 shadow-qualita">
                <h2 className="font-sans text-[1rem] font-bold text-navy">Resumen del análisis</h2>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-tinta">{results.resumen}</p>
              </section>

              {/* Los componentes del informe público, sin tocar: una sola
                  fuente de verdad para lo que dice el diagnóstico. */}
              <div className="mt-4 overflow-hidden rounded-card border border-linea bg-card shadow-qualita [&>section:last-child]:border-b-0">
                <Pilares infra={results.infra} scoreInfra={dg.score_infra} />
                <Fugas fugas={results.fugas} />
                <AValidar items={results.a_validar} />
              </div>

              <DatosTecnicos facts={results.facts} />
            </>
          ) : (
            <div className="mt-4">
              <Vacio>
                {dg.status === "pending" || dg.status === "analyzing"
                  ? "El análisis todavía está corriendo. Volvé en un rato."
                  : "Este diagnóstico no tiene un results legible (puede ser de una versión anterior del método)."}
              </Vacio>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-6">
          <AccionesLead
            diagnosticId={dg.id}
            estadoActual={dg.lead_status}
            status={dg.status}
            reviewedBy={dg.reviewed_by}
          />
        </div>
      </div>
    </>
  );
}

function Puntaje({
  label,
  score,
  destacado,
}: {
  label: string;
  score: number | null;
  destacado?: boolean;
}) {
  return (
    <div>
      <p className="text-[0.72rem] font-semibold tracking-[0.08em] text-tinta2 uppercase">
        {label}
      </p>
      <div className="mt-1.5">
        <BarraScore score={score} />
      </div>
      {destacado && score !== null ? (
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${nivelDeScore(score).clase}`}
        >
          {nivelDeScore(score).label}
        </span>
      ) : null}
    </div>
  );
}

function normalizarUrl(website: string): string {
  const crudo = website.trim();
  return /^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`;
}
