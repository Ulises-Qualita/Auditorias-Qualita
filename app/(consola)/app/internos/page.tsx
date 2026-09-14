import type { Metadata } from "next";
import Link from "next/link";

import { fechaRelativa } from "@/lib/consola/leads";
import { listarInternos } from "@/lib/consola/queries";
import { FaviconEmpresa } from "../_components/FaviconEmpresa";
import { EliminarFila } from "../diagnosticos/[id]/EliminarFila";
import { BarraScore, CabeceraPagina, PillAnalisis, Vacio } from "../_components/ui";

/** Diagnósticos que generó el equipo desde la consola. No son leads: no hay
 *  contacto ni estado de lead, y no cuentan en el panel ni en el badge. */

export const metadata: Metadata = {
  title: "Diagnósticos internos — Consola Qualita",
  robots: { index: false, follow: false },
};

export default async function InternosPage() {
  const filas = await listarInternos();

  return (
    <>
      <CabeceraPagina
        titulo="Diagnósticos internos"
        desc="Los que genera el equipo para prospectar o preparar una reunión. Sin límite por email y fuera del embudo de leads."
        accion={
          <Link
            href="/app/internos/nuevo"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.88rem] font-semibold text-white transition hover:-translate-y-px"
            style={{ background: "var(--grad)" }}
          >
            <span aria-hidden="true" className="text-[1.1rem] leading-none">
              +
            </span>
            Generar diagnóstico
          </Link>
        }
      />

      {filas.length === 0 ? (
        <Vacio>Todavía no se generó ningún diagnóstico interno.</Vacio>
      ) : (
        <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-qualita">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Empresa", "Rubro", "Generado por", "Fecha", "Madurez", "Análisis"].map((th) => (
                  <th
                    key={th}
                    scope="col"
                    className="border-b border-linea bg-bg px-4 py-3.5 text-left text-[0.7rem] font-bold tracking-[0.05em] whitespace-nowrap text-tinta2 uppercase"
                  >
                    {th}
                  </th>
                ))}
                <th scope="col" className="border-b border-linea bg-bg px-4 py-3.5">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const nombre = fila.empresa?.name ?? "Empresa sin nombre";
                return (
                  <tr
                    key={fila.id}
                    className="relative cursor-pointer border-b border-linea2 last:border-none hover:bg-[#faf9fe]"
                  >
                    <td className="px-4 py-3.5">
                      {/* El ::after estira el link sobre toda la fila. */}
                      <Link
                        href={`/app/internos/${fila.id}`}
                        className="flex items-center gap-3 after:absolute after:inset-0"
                      >
                        <FaviconEmpresa website={fila.empresa?.website ?? null} nombre={nombre} />
                        <span>
                          <span className="block font-semibold text-navy">{nombre}</span>
                          {fila.empresa?.website ? (
                            <span className="block text-[0.76rem] text-tinta2">
                              {fila.empresa.website.replace(/^https?:\/\//, "")}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[0.88rem] text-navy">
                      {fila.empresa?.industry ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[0.84rem] text-tinta">{fila.creado_por ?? "—"}</td>
                    <td className="px-4 py-3.5 text-[0.88rem] whitespace-nowrap text-tinta">
                      {fechaRelativa(fila.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <BarraScore score={fila.score_general} />
                    </td>
                    <td className="px-4 py-3.5">
                      <PillAnalisis status={fila.status} />
                    </td>
                    <td className="px-2 py-3.5 text-right">
                      <EliminarFila diagnosticId={fila.id} nombre={nombre} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filas.length > 0 ? (
        <p className="mt-3 text-[0.78rem] text-tinta2">
          {filas.length} {filas.length === 1 ? "diagnóstico interno" : "diagnósticos internos"} · más
          reciente primero
        </p>
      ) : null}
    </>
  );
}
