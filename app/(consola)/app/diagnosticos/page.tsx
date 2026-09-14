import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import {
  ESTADO_LEAD,
  esEstadoLead,
  fechaRelativa,
  type EstadoLead,
} from "@/lib/consola/leads";
import { contarLeads, listarDiagnosticos } from "@/lib/consola/queries";
import { FaviconEmpresa } from "../_components/FaviconEmpresa";
import { EliminarFila } from "./[id]/EliminarFila";
import {
  BarraScore,
  CabeceraPagina,
  PillAnalisis,
  PillLead,
  Vacio,
} from "../_components/ui";

/** Listado de autodiagnósticos. Solo lectura: cambiar el estado de un lead
 *  llega en 4c, con server actions.
 *
 *  El filtro viaja en la URL (?estado=nuevo) y se resuelve contra la base, no
 *  en el browser: la página ya es un server component, así el estado del
 *  filtro es compartible, sobrevive al refresh y no hace falta mandar todas
 *  las filas al cliente para esconder la mitad. */

export const metadata: Metadata = {
  title: "Autodiagnósticos — Consola Qualita",
  robots: { index: false, follow: false },
};

/** Los estados que se ofrecen como filtro. `descartado` queda afuera del
 *  toolbar a propósito (es ruido en el día a día); se sigue viendo en Todos. */
const FILTROS: EstadoLead[] = ["nuevo", "contactado", "conversacion", "cliente"];

export default async function DiagnosticosPage({ searchParams }: PageProps<"/app/diagnosticos">) {
  const { estado } = await searchParams;
  const filtro = esEstadoLead(typeof estado === "string" ? estado : undefined)
    ? (estado as EstadoLead)
    : undefined;

  const [filas, conteos] = await Promise.all([listarDiagnosticos(filtro), contarLeads()]);

  return (
    <>
      <CabeceraPagina
        titulo="Autodiagnósticos"
        desc="Empresas que se diagnosticaron solas desde la web. Cada una es un lead calificado."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <PillFiltro href="/app/diagnosticos" label="Todos" cantidad={conteos.total} on={!filtro} />
        {FILTROS.map((e) => (
          <PillFiltro
            key={e}
            href={`/app/diagnosticos?estado=${e}`}
            label={ESTADO_LEAD[e].plural}
            cantidad={conteos[e]}
            on={filtro === e}
          />
        ))}
      </div>

      {filas.length === 0 ? (
        <Vacio>
          {filtro
            ? `No hay autodiagnósticos en “${ESTADO_LEAD[filtro].plural.toLowerCase()}”.`
            : "Todavía no entró ningún autodiagnóstico."}
        </Vacio>
      ) : (
        <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-qualita">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Empresa", "Contacto", "Rubro", "Fecha", "Madurez", "Análisis", "Estado"].map(
                  (th) => (
                    <th
                      key={th}
                      scope="col"
                      className="border-b border-linea bg-bg px-4 py-3.5 text-left text-[0.7rem] font-bold tracking-[0.05em] text-tinta2 uppercase whitespace-nowrap"
                    >
                      {th}
                    </th>
                  ),
                )}
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
                      {/* Un <a> real y no un onClick en el <tr>, para que se pueda
                          navegar con teclado y abrir en pestaña nueva. El ::after
                          lo estira sobre toda la fila; el mailto va por encima. */}
                      <Link
                        href={`/app/diagnosticos/${fila.id}`}
                        className="flex items-center gap-3 after:absolute after:inset-0"
                      >
                        <FaviconEmpresa website={fila.empresa?.website ?? null} nombre={nombre} />
                        <span>
                          <span className="block font-semibold text-navy">{nombre}</span>
                          {fila.empresa?.province ? (
                            <span className="block text-[0.76rem] text-tinta2">
                              {fila.empresa.province}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block text-[0.88rem] font-semibold text-navy">
                        {fila.empresa?.contact_name ?? "—"}
                      </span>
                      {fila.empresa?.contact_email ? (
                        <a
                          href={`mailto:${fila.empresa.contact_email}`}
                          className="relative z-10 block text-[0.78rem] text-tinta2 hover:text-magenta"
                        >
                          {fila.empresa.contact_email}
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-[0.88rem] text-navy">
                      {fila.empresa?.industry ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[0.88rem] whitespace-nowrap text-tinta">
                      {fechaRelativa(fila.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <BarraScore score={fila.score_general} />
                    </td>
                    <td className="px-4 py-3.5">
                      <PillAnalisis status={fila.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <PillLead estado={fila.lead_status} />
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
          {filas.length} {filas.length === 1 ? "autodiagnóstico" : "autodiagnósticos"} · más
          reciente primero
        </p>
      ) : null}
    </>
  );
}

function PillFiltro({
  href,
  label,
  cantidad,
  on,
}: {
  href: Route;
  label: string;
  cantidad: number;
  on: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[0.82rem] font-semibold transition ${
        on
          ? "border-navy bg-navy text-white"
          : "border-linea bg-white text-tinta hover:border-tinta2"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[0.72rem] ${on ? "bg-white/20" : "bg-black/[.06]"}`}
      >
        {cantidad}
      </span>
    </Link>
  );
}
