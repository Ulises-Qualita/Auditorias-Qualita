import { formatearUsd } from "@/lib/analysis/costo";
import type { GastoDiagnostico, GastoGlobal } from "@/lib/consola/costos";

/** Lo que gasta la API de Claude, en la consola.
 *
 *  Server components: los datos ya vienen resueltos y no hay interacción.
 *
 *  Una aclaración que la UI repite porque importa: esto es GASTO, no SALDO. La
 *  API de Anthropic no expone el crédito restante por ningún endpoint, así que
 *  el saldo se mira en la Consola de Anthropic y acá se muestra lo que
 *  nosotros efectivamente consumimos. */

/** El costo de UN análisis, en el detalle del diagnóstico. */
export function CostoDelAnalisis({ gasto }: { gasto: GastoDiagnostico | null }) {
  return (
    <div className="rounded-card border border-linea bg-card p-5 shadow-qualita">
      <p className="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] text-magenta uppercase">
        <span aria-hidden="true" className="block h-px w-4 bg-coral" />
        Costo del análisis
      </p>

      {gasto === null ? (
        <FaltaMigracion />
      ) : gasto.costoUsd === null ? (
        <p className="mt-3 text-[0.85rem] text-tinta">
          Este diagnóstico no consumió API. Es un análisis mock, o falló antes de llamar a
          Claude.
        </p>
      ) : (
        <>
          <p className="mt-3 flex items-baseline gap-2">
            <b className="font-display text-[1.8rem] leading-none font-bold text-navy">
              {formatearUsd(gasto.costoUsd)}
            </b>
            <span className="text-[0.8rem] text-tinta2">USD</span>
          </p>

          {gasto.uso && (
            <dl className="mt-4 border-t border-linea2 pt-3 text-[0.82rem]">
              <Fila k="Modelo" v={gasto.uso.modelo} />
              <Fila
                k="Llamadas"
                v={
                  gasto.uso.llamadas === 1
                    ? "1"
                    : `${gasto.uso.llamadas} (hubo corrección de esquema)`
                }
              />
              <Fila k="Tokens de entrada" v={miles(gasto.uso.inputTokens)} />
              <Fila k="Tokens de salida" v={miles(gasto.uso.outputTokens)} />
              {gasto.uso.cacheReadTokens > 0 && (
                <Fila k="Leídos de caché" v={miles(gasto.uso.cacheReadTokens)} />
              )}
            </dl>
          )}
        </>
      )}
    </div>
  );
}

/** Los totales, para el panel. */
export function GastoApi({ gasto }: { gasto: GastoGlobal | null }) {
  if (gasto === null) {
    return (
      <section className="rounded-card border border-linea bg-card p-5 shadow-qualita">
        <Titulo />
        <FaltaMigracion />
      </section>
    );
  }

  return (
    <section className="rounded-card border border-linea bg-card p-5 shadow-qualita">
      <Titulo />

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Cifra label="Gastado en total" valor={formatearUsd(gasto.totalUsd)} />
        <Cifra label="Últimos 30 días" valor={formatearUsd(gasto.ultimos30Usd)} />
        <Cifra
          label="Promedio por diagnóstico"
          valor={formatearUsd(gasto.promedioUsd)}
          nota={gasto.conCosto === 1 ? "sobre 1 análisis" : `sobre ${gasto.conCosto} análisis`}
        />
      </div>

      {gasto.fuente === "diagnosticos" && (
        <p className="mt-4 rounded-campo border border-info/25 bg-infobg px-3 py-2 text-[0.82rem] text-navy">
          Este total todavía pierde lo gastado en diagnósticos borrados y en reintentos. Corré{" "}
          <code className="font-mono">docs/registro-gasto.sql</code> en Supabase para que quede
          registrado todo lo gastado.
        </p>
      )}

      <p className="mt-4 border-t border-linea2 pt-3 text-[0.8rem] text-tinta">
        Esto es lo que consumimos nosotros, calculado sobre los tokens reales de cada
        respuesta. <b className="font-semibold text-navy">No es el saldo</b>: la API de
        Anthropic no expone el crédito disponible, así que ese número se mira en la{" "}
        <a
          href="https://console.anthropic.com/settings/billing"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-magenta underline underline-offset-2"
        >
          Consola de Anthropic
        </a>
        .
      </p>
    </section>
  );
}

function Titulo() {
  return (
    <p className="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.12em] text-magenta uppercase">
      <span aria-hidden="true" className="block h-px w-4 bg-coral" />
      Gasto de la API
    </p>
  );
}

/** El costo es opcional por diseño: la app funciona sin las columnas. Cuando
 *  faltan, se dice qué hacer en vez de mostrar un cero que sería mentira. */
function FaltaMigracion() {
  return (
    <p className="mt-3 rounded-campo border border-info/25 bg-infobg px-3 py-2 text-[0.82rem] text-navy">
      Falta correr <code className="font-mono">docs/costos-analisis.sql</code> en Supabase
      para empezar a registrar el costo de cada análisis.
    </p>
  );
}

function Cifra({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div>
      <b className="font-display block text-[1.5rem] leading-none font-bold text-navy">
        {valor}
      </b>
      <p className="mt-1.5 text-[0.8rem] text-tinta">{label}</p>
      {nota && <p className="text-[0.74rem] text-tinta2">{nota}</p>}
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-linea2 py-1.5 last:border-b-0">
      <dt className="text-tinta">{k}</dt>
      <dd className="text-right font-medium text-navy">{v}</dd>
    </div>
  );
}

function miles(n: number): string {
  return n.toLocaleString("es-AR");
}
