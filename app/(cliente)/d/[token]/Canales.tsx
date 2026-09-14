import { CANALES, type ClaveCanal } from "@/lib/analysis/schema";
import { ETIQUETA_ESTADO, type CanalInforme, type Check } from "@/lib/diagnostico/results";

/** Los canales del diagnóstico, en el orden del recorrido del comprador.
 *
 *  Reemplaza a las dos solapas de pilares (Marca / Infraestructura). Hay un
 *  solo pilar —Arquitectura digital— y la auditoría de referencia no se
 *  organiza por pilares sino por puertas: sitio, contacto, orden, qué ve
 *  Google, medición. Sin tabs: el informe se lee de corrido, como el PDF.
 *
 *  Server component: no hay estado, solo datos que ya vienen resueltos. */

type Canales = Record<ClaveCanal, CanalInforme>;

/** El "de un vistazo" (pág. 13 de la auditoría): cada canal con su escala de
 *  cinco puntos. Va antes del detalle porque es el mapa: primero se ve cómo
 *  está todo, después por qué. */
export function ResumenCanales({ canales }: { canales: Canales }) {
  return (
    <section className="border-b border-linea bg-crema px-[clamp(18px,5vw,32px)] py-[clamp(38px,6vw,54px)]">
      <div className="mx-auto w-full max-w-[940px]">
        <Kicker>Resumen</Kicker>
        <h2 className="mt-3 text-[clamp(1.25rem,2.6vw,1.5rem)] font-semibold text-navy">
          Cómo está cada canal, de un vistazo
        </h2>
        <p className="mt-2 max-w-[54ch] text-[0.94rem] text-tinta">
          Cinco puntos = profesional y sostenido. Un punto = no existe o está roto.
        </p>

        <ul className="mt-7 overflow-hidden rounded-card border border-linea bg-white shadow-qualita">
          {CANALES.map(([clave, rotulo]) => {
            const canal = canales[clave];
            return (
              <li
                key={clave}
                className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1.5 border-b border-linea2 px-5 py-4 last:border-b-0 sm:grid-cols-[190px_1fr_auto] sm:items-center"
              >
                <span className="min-w-0 text-[0.95rem] leading-[1.3] font-semibold text-navy">
                  {rotulo}
                </span>

                {/* Los puntos van pegados al nombre en mobile (donde la frase
                    pasa abajo, a lo ancho) y al final de la fila en desktop,
                    como la lámina del ejemplo. */}
                <span className="justify-self-end sm:order-3">
                  <Dots valor={canal.madurez} estado={canal.estado} />
                </span>

                <span className="col-span-2 min-w-0 text-[0.88rem] leading-[1.45] text-tinta sm:order-2 sm:col-span-1">
                  {canal.insight}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** El detalle canal por canal, con la evidencia. */
export function Canales({ canales }: { canales: Canales }) {
  return (
    <section className="border-b border-linea bg-bg px-[clamp(18px,5vw,32px)] py-[46px]">
      <div className="mx-auto w-full max-w-[940px]">
        <Kicker>Arquitectura digital</Kicker>
        <h2 className="mt-3 text-[1.35rem] font-semibold">Qué encontramos, canal por canal</h2>
        <p className="mt-1.5 max-w-[52ch] text-tinta">
          Cada hallazgo sale de lo que se pudo verificar en tu sitio. Lo que no se pudo
          verificar, se dice.
        </p>

        <div className="mt-6 grid gap-4">
          {CANALES.map(([clave, rotulo]) => (
            <TarjetaCanal key={clave} rotulo={rotulo} canal={canales[clave]} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TarjetaCanal({ rotulo, canal }: { rotulo: string; canal: CanalInforme }) {
  const estado = ETIQUETA_ESTADO[canal.estado];

  return (
    <article className="rounded-[14px] border border-linea bg-white p-5 shadow-qualita">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[1.05rem] font-semibold text-navy">{rotulo}</h3>
        <span
          className={`rounded-full px-[11px] py-[5px] text-[0.72rem] font-bold ${estado.clase}`}
        >
          {estado.label}
        </span>
        <span className="ml-auto">
          <Dots valor={canal.madurez} estado={canal.estado} />
        </span>
      </div>

      <p className="mt-3 text-[0.95rem]">{canal.insight}</p>

      {canal.checks.length > 0 && (
        <ul className="mt-5 border-t border-linea2">
          {canal.checks.map((check, i) => (
            <li
              key={`${check.titulo}-${i}`}
              className="flex gap-3.5 border-b border-linea2 py-3.5 last:border-b-0"
            >
              <IconoCheck tipo={check.tipo} />
              <div>
                <div className="text-[0.92rem] font-semibold">{check.titulo}</div>
                {check.detalle && (
                  <div className="mt-1 text-[0.88rem] text-tinta">{check.detalle}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** La escala de la auditoría. Con estado 'a_validar' no pintamos ningún punto:
 *  no pudimos mirar el canal, y un punto lleno diría que sí lo miramos. */
function Dots({ valor, estado }: { valor: number; estado: CanalInforme["estado"] }) {
  if (estado === "a_validar") {
    return (
      <span className="rounded-full bg-infobg px-2.5 py-[3px] text-[0.66rem] font-bold tracking-[0.08em] text-info uppercase">
        Sin verificar
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className="sr-only">Madurez {valor} de 5</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${n <= valor ? "bg-navy" : "bg-linea"}`}
        />
      ))}
    </span>
  );
}

const ICONO: Record<Check["tipo"], { simbolo: string; clase: string; etiqueta: string }> = {
  error: { simbolo: "✕", clase: "bg-warnbg text-warn", etiqueta: "Problema" },
  alerta: { simbolo: "!", clase: "bg-midbg text-mid", etiqueta: "Atención" },
  ok: { simbolo: "✓", clase: "bg-okbg text-ok", etiqueta: "Bien" },
};

function IconoCheck({ tipo }: { tipo: Check["tipo"] }) {
  const icono = ICONO[tipo];
  return (
    <span
      className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-[0.8rem] font-bold ${icono.clase}`}
    >
      <span className="sr-only">{icono.etiqueta}: </span>
      <span aria-hidden="true">{icono.simbolo}</span>
    </span>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 text-[0.68rem] font-bold tracking-[0.2em] text-magenta uppercase">
      <span aria-hidden="true" className="h-px w-5 flex-none bg-coral" />
      {children}
    </span>
  );
}
