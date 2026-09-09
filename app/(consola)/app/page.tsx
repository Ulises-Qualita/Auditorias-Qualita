import type { Metadata } from "next";
import Link from "next/link";

import { ESTADOS_LEAD, ESTADO_LEAD, colorScore, fechaRelativa } from "@/lib/consola/leads";
import {
  contarLeads,
  madurezPorCanal,
  madurezPromedio,
  rubrosMasDiagnosticados,
  ultimosNuevos,
} from "@/lib/consola/queries";
import {
  BarraRanking,
  BotonSecundario,
  CabeceraPagina,
  Panel,
  Tile,
  Vacio,
} from "./_components/ui";
import { FaviconEmpresa } from "./_components/FaviconEmpresa";

/** Panel de la consola. Todo lo que se ve sale de la base: si hay tres
 *  diagnósticos, los números dicen tres. No hay mínimos ni datos de relleno. */

export const metadata: Metadata = {
  title: "Panel — Consola Qualita",
  robots: { index: false, follow: false },
};

export default async function PanelPage() {
  const [conteos, promedio, rubros, canales, recientes] = await Promise.all([
    contarLeads(),
    madurezPromedio(),
    rubrosMasDiagnosticados(),
    madurezPorCanal(),
    ultimosNuevos(),
  ]);

  const conversion =
    conteos.total > 0 ? Math.round((conteos.cliente / conteos.total) * 100) : null;

  return (
    <>
      <CabeceraPagina
        titulo="Así viene la semana"
        desc="Resumen del workspace y lo que entró por autodiagnóstico."
        accion={<BotonSecundario href="/app/diagnosticos">Ver autodiagnósticos</BotonSecundario>}
      />

      {conteos.nuevo > 0 ? (
        <div
          className="mb-6 flex flex-wrap items-center gap-4 rounded-card border border-linea px-5 py-4"
          style={{ background: "var(--grad-soft)" }}
        >
          <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-white shadow-qualita">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#B50CC5"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5V12l3 1.8" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex-1">
            <b className="font-semibold text-navy">
              {conteos.nuevo === 1
                ? "Tenés 1 autodiagnóstico sin contactar."
                : `Tenés ${conteos.nuevo} autodiagnósticos sin contactar.`}
            </b>
            <p className="mt-0.5 text-[0.85rem] text-tinta">
              Los primeros minutos son los que mejor convierten.
            </p>
          </div>
          <BotonSecundario href="/app/diagnosticos?estado=nuevo">Revisar ahora</BotonSecundario>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile
          label="Autodiagnósticos"
          valor={conteos.total}
          color="var(--magenta)"
          nota={conteos.total === 0 ? "todavía ninguno" : "en total"}
        />
        <Tile
          label="Sin contactar"
          valor={conteos.nuevo}
          color="var(--info)"
          nota={conteos.nuevo > 0 ? "requieren seguimiento" : "todo al día"}
        />
        <Tile
          label="Madurez promedio"
          valor={promedio ?? "—"}
          sufijo={promedio === null ? undefined : "/100"}
          color="var(--coral)"
          nota={promedio === null ? "sin diagnósticos puntuados" : "de las empresas analizadas"}
        />
        <Tile
          label="Convertidos"
          valor={conteos.cliente}
          color="var(--ok)"
          nota={conversion === null ? "sin datos" : `${conversion}% del total`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          titulo="Entró recién"
          desc="Autodiagnósticos sin contactar"
          extra={
            conteos.nuevo > 0 ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.74rem] font-bold whitespace-nowrap ${ESTADO_LEAD.nuevo.pill}`}
              >
                <span
                  aria-hidden="true"
                  className={`block size-[7px] rounded-full ${ESTADO_LEAD.nuevo.punto}`}
                />
                {conteos.nuevo} {conteos.nuevo === 1 ? "nuevo" : "nuevos"}
              </span>
            ) : null
          }
        >
          {recientes.length === 0 ? (
            <Vacio>Todavía no entró ningún autodiagnóstico sin contactar.</Vacio>
          ) : (
            <div>
              {recientes.map((fila) => {
                const nombre = fila.empresa?.name ?? "Empresa sin nombre";
                return (
                  <Link
                    key={fila.id}
                    href={`/app/diagnosticos/${fila.id}`}
                    className="flex items-center justify-between gap-3 border-b border-linea2 py-3 last:border-none hover:bg-[#faf9fe]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <FaviconEmpresa
                        website={fila.empresa?.website ?? null}
                        nombre={nombre}
                        size={34}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-navy">{nombre}</span>
                        <span className="block text-[0.76rem] text-tinta2">
                          {[fila.empresa?.industry, fechaRelativa(fila.created_at)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </span>
                    {fila.score_general === null ? (
                      <span className="text-[0.78rem] text-tinta2">Sin puntuar</span>
                    ) : (
                      <b
                        className="font-display text-[0.95rem] font-bold"
                        style={{ color: colorScore(fila.score_general) }}
                      >
                        {fila.score_general}
                      </b>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel titulo="Rubros más diagnosticados" desc="Dónde hay más demanda buscando">
          {rubros.length === 0 ? (
            <Vacio>Se llena con más diagnósticos.</Vacio>
          ) : (
            <div>
              {rubros.map((rubro) => (
                <BarraRanking
                  key={rubro.nombre}
                  label={rubro.nombre}
                  valor={String(rubro.cantidad)}
                  porcentaje={Math.round((rubro.cantidad / rubros[0].cantidad) * 100)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          titulo="Madurez promedio por canal"
          desc={
            canales[0].base > 0
              ? `Sobre ${canales[0].base} ${canales[0].base === 1 ? "diagnóstico" : "diagnósticos"} analizados`
              : "Sobre los diagnósticos ya analizados"
          }
        >
          {canales.every((canal) => canal.base === 0) ? (
            <Vacio>Se llena cuando haya diagnósticos con análisis terminado.</Vacio>
          ) : (
            <>
              <div>
                {canales.map((canal) => (
                  <BarraRanking
                    key={canal.id}
                    label={canal.label}
                    valor={`${canal.promedio}%`}
                    porcentaje={canal.promedio}
                    anchoLabel="w-28"
                  />
                ))}
              </div>
              <p className="mt-4 text-[0.78rem] text-tinta2">
                Google Ads, Meta Ads y el pilar de marca no tienen número: el análisis los deja
                marcados “a validar” a mano.
              </p>
            </>
          )}
        </Panel>

        <Panel
          titulo="Embudo de leads"
          desc={
            conteos.total === 1
              ? "Estado del único autodiagnóstico"
              : `Estado de los ${conteos.total} autodiagnósticos`
          }
        >
          <div className="mb-4 flex h-[18px] gap-0.5 overflow-hidden rounded-[9px] bg-linea2">
            {conteos.total > 0
              ? ESTADOS_LEAD.filter((estado) => conteos[estado] > 0).map((estado) => (
                  <span
                    key={estado}
                    className="h-full"
                    style={{
                      width: `${(conteos[estado] / conteos.total) * 100}%`,
                      background: ESTADO_LEAD[estado].color,
                    }}
                  />
                ))
              : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {ESTADOS_LEAD.map((estado) => (
              <span key={estado} className="flex items-center gap-2 text-[0.82rem] text-tinta">
                <span
                  aria-hidden="true"
                  className="block size-2.5 rounded-[3px]"
                  style={{ background: ESTADO_LEAD[estado].color }}
                />
                {ESTADO_LEAD[estado].plural} <b className="text-navy">{conteos[estado]}</b>
              </span>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
