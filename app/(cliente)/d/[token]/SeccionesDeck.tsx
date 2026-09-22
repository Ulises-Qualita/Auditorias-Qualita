import { CANALES, type ClaveCanal } from "@/lib/analysis/schema";
import type {
  CanalInforme,
  Check,
  Fuga,
  NumeroDestacado,
  PasoPlan,
  PasoRecorrido,
} from "@/lib/diagnostico/results";
import {
  Banda,
  DatoGrande,
  Lamina,
  SinVerificar,
  Tarjeta,
  tamanoDeGrupo,
  type Tono,
} from "./Deck";

/** Las láminas del deck que salen de `results` (lo que interpretó el
 *  análisis). Las que salen de hechos deterministas están en HechosDeck.tsx.
 *
 *  Nada de Audifarm: los títulos de lámina son genéricos o se arman con datos
 *  del diagnóstico. Cuando falta el dato, la lámina no se dibuja. */

type ConEmpresa = { empresa: string };

/** "Por dónde miramos": explicativa. Las puertas dependen de lo que ESTA
 *  corrida miró de verdad: con búsqueda web son cinco —se suman lo que Google
 *  devuelve, los anuncios y lo que se ve de la marca—, y sin ella son las
 *  cuatro del sitio. Nunca se promete una puerta que no se abrió. */
export function PorDondeMiramos({ empresa, conBusqueda }: ConEmpresa & { conBusqueda: boolean }) {
  const delSitio = [
    ["Sitio web", "Cómo está armado y si está a la altura de la empresa"],
    ["Vías de contacto", "Si deja pedir un presupuesto sin tener que buscarlo"],
    ["Cómo está ordenado", "Si las secciones siguen cómo busca el que compra"],
    ["Qué ve Google", "Si el sitio le dice a Google qué vende y para quién"],
  ] as const;

  const deAfuera = [
    ["Sitio web", "Cómo está armado y si deja pedir un presupuesto"],
    ["Búsquedas en Google", "Qué aparece cuando alguien busca lo que vendés"],
    ["La competencia", "Quién ocupa esos lugares y qué hace distinto"],
    ["Anuncios", "Si alguien del sector le está comprando el clic a quién"],
    ["Redes y ficha", "Lo que ve de tu marca el que ya te conoce"],
  ] as const;

  const puertas = conBusqueda ? deAfuera : delSitio;

  return (
    <Lamina
      empresa={empresa}
      kicker="Por dónde miramos"
      titulo={
        conBusqueda
          ? "Las cinco puertas por donde entra una consulta"
          : "Las cuatro puertas por donde entra una consulta a tu sitio"
      }
      lead="El sitio es donde termina cayendo todo lo que genera la marca afuera. Por eso es donde pusimos la lupa."
    >
      <div
        className={`grid grid-cols-1 gap-[clamp(12px,1.4vw,18px)] sm:grid-cols-2 ${
          puertas.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"
        }`}
      >
        {puertas.map(([titulo, detalle], i) => (
          <Tarjeta key={titulo} className="relative">
            <span
              className={`disp mb-4 flex h-8 w-8 items-center justify-center rounded-full text-[.82rem] font-bold text-white ${
                i === 0 ? "bg-coral" : "bg-magenta"
              }`}
            >
              {i + 1}
            </span>
            {i === 0 && (
              <span className="absolute top-[clamp(16px,1.9vw,24px)] right-[clamp(16px,1.9vw,24px)] rounded-full bg-coral px-2.5 py-1 text-[.6rem] font-bold tracking-[.1em] text-white">
                FOCO
              </span>
            )}
            <h3 className="mb-2.5 text-[clamp(.98rem,1.1vw,1.1rem)] font-semibold text-navy">
              {titulo}
            </h3>
            <p className="text-[clamp(.84rem,.92vw,.9rem)] leading-[1.45] text-(--d-tinta)">
              {detalle}
            </p>
          </Tarjeta>
        ))}
      </div>
      <Banda>
        Y una cosa más que cruza a todas: la medición. Si no se mide, ninguna de las{" "}
        {puertas.length === 5 ? "cinco" : "cuatro"} se puede corregir.
      </Banda>
    </Lamina>
  );
}

/** "Lo que ya tienen": se abre por lo que juega a favor. Vacío = no se
 *  dibuja; nunca se rellena. */
export function LoQueYaTienen({ empresa, activos }: ConEmpresa & { activos: NumeroDestacado[] }) {
  if (activos.length === 0) return null;
  const tamano = tamanoDeGrupo(activos.map((a) => a.dato));

  return (
    <Lamina
      empresa={empresa}
      kicker="Lo que ya tenés"
      titulo="Nada de esto hay que construirlo de cero"
      lead="Estos datos están verificados. El problema no es lo que falta: es que lo que hay todavía no está conectado."
    >
      <div className="grid grid-cols-1 gap-[clamp(14px,1.6vw,20px)] sm:grid-cols-2 lg:grid-cols-3">
        {activos.map((activo, i) => (
          <Tarjeta key={`${activo.dato}-${i}`}>
            <DatoGrande valor={activo.dato} tamano={tamano} />
            <p className="mt-3 text-[clamp(.84rem,.92vw,.9rem)] leading-[1.45] text-(--d-tinta)">
              {activo.etiqueta}
            </p>
          </Tarjeta>
        ))}
      </div>
    </Lamina>
  );
}

/** "El recorrido": tarjetas encadenadas sobre navy. El tono de alerta de la
 *  última lo decide el canal de contacto (ver page.tsx), no el texto. */
export function Recorrido({
  empresa,
  pasos,
  desenlaceCritico,
}: ConEmpresa & { pasos: PasoRecorrido[]; desenlaceCritico: boolean }) {
  if (pasos.length === 0) return null;

  return (
    <Lamina
      tono="dark"
      empresa={empresa}
      kicker="El recorrido"
      titulo="Alguien entra a tu sitio con intención de comprar. ¿Dónde deja el dato?"
    >
      <ol
        className={`grid grid-cols-1 gap-3 lg:gap-7 ${
          pasos.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {pasos.map((paso, i) => {
          const alerta = i === pasos.length - 1 && desenlaceCritico;
          return (
            <li key={`${paso.paso}-${i}`} className="relative min-w-0">
              <div
                className={`h-full rounded-[14px] p-[clamp(16px,1.9vw,24px)] ${
                  alerta ? "bg-(--d-alert)" : "bg-white/[.05]"
                }`}
              >
                <div className="mb-3 text-[.66rem] font-bold tracking-[.12em] text-coral uppercase">
                  {paso.paso}
                </div>
                <p
                  className={`text-[clamp(.88rem,.98vw,.94rem)] leading-[1.45] ${
                    alerta ? "text-[#ff8a7e]" : "text-white/85"
                  }`}
                >
                  {paso.detalle}
                </p>
              </div>
              {i < pasos.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-[20px] hidden -translate-y-1/2 text-[1.3rem] text-white/30 lg:block"
                >
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Lamina>
  );
}

/** El checklist técnico ✕ / ! / ✓ de la vista anterior del informe, adentro
 *  de la lámina. Los colores son los de estado del manual; sobre la lámina
 *  oscura van un poco más claros para que el ícono se lea. */
const ICONO_CHECK: Record<
  Check["tipo"],
  { simbolo: string; etiqueta: string; claro: string; oscuro: string }
> = {
  error: {
    simbolo: "✕",
    etiqueta: "Problema",
    claro: "bg-warnbg text-warn",
    oscuro: "bg-[rgba(224,73,47,.22)] text-[#ff9d92]",
  },
  alerta: {
    simbolo: "!",
    etiqueta: "Atención",
    claro: "bg-midbg text-mid",
    oscuro: "bg-[rgba(181,116,0,.28)] text-[#f5c979]",
  },
  ok: {
    simbolo: "✓",
    etiqueta: "Bien",
    claro: "bg-okbg text-ok",
    oscuro: "bg-[rgba(31,157,99,.24)] text-[#71dfa9]",
  },
};

function IconoCheck({ tipo, oscuro }: { tipo: Check["tipo"]; oscuro: boolean }) {
  const icono = ICONO_CHECK[tipo];
  return (
    <span
      className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg font-sans text-[.8rem] font-bold ${
        oscuro ? icono.oscuro : icono.claro
      }`}
    >
      <span className="sr-only">{icono.etiqueta}: </span>
      <span aria-hidden="true">{icono.simbolo}</span>
    </span>
  );
}

/** Un canal contado como el deck: el insight de bajada y cada check como una
 *  fila del checklist. Sirve para el sitio, el orden y lo que ve Google. */
export function LaminaCanal({
  empresa,
  tono = "light",
  kicker,
  titulo,
  canal,
}: ConEmpresa & { tono?: Tono; kicker: string; titulo: string; canal: CanalInforme }) {
  if (canal.checks.length === 0 && !canal.insight) return null;
  const oscuro = tono === "dark";

  return (
    <Lamina tono={tono} empresa={empresa} kicker={kicker} titulo={titulo} lead={canal.insight}>
      {canal.estado === "a_validar" && <SinVerificar />}
      {canal.checks.length > 0 && (
        <ul className="flex flex-col gap-[clamp(14px,1.9vw,24px)]">
          {canal.checks.map((check, i) => {
            return (
              <li
                key={`${check.titulo}-${i}`}
                // La columna del detalle se topa en ~72 caracteres: a 1500px de
                // lámina, un 1fr daba renglones de 150 que no se leen.
                className="grid grid-cols-1 items-start gap-1.5 md:grid-cols-[clamp(220px,24vw,340px)_minmax(0,72ch)] md:gap-8"
              >
                <div
                  className={`disp flex items-center gap-3 text-[clamp(.94rem,1.05vw,1.02rem)] leading-[1.3] font-semibold ${
                    oscuro ? "text-white" : "text-navy"
                  }`}
                >
                  <IconoCheck tipo={check.tipo} oscuro={oscuro} />
                  {check.titulo}
                </div>
                {check.detalle && (
                  <p
                    className={`pl-[38px] text-[clamp(.86rem,.94vw,.92rem)] leading-[1.5] md:pl-0 ${
                      oscuro ? "text-white/65" : "text-(--d-tinta)"
                    }`}
                  >
                    {check.detalle}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Lamina>
  );
}

/** "Los puntos de fuga": el título arriba y el bloque QUÉ SE PIERDE abajo. */
export function Fugas({ empresa, fugas }: ConEmpresa & { fugas: Fuga[] }) {
  if (fugas.length === 0) return null;

  return (
    <Lamina
      empresa={empresa}
      kicker="Dónde se pierden consultas"
      titulo={
        fugas.length === 1
          ? "El punto de fuga más urgente"
          : `Los ${fugas.length} puntos de fuga más urgentes`
      }
      lead="Lo que hoy corta el camino entre alguien interesado y una consulta tuya."
    >
      <div className="grid grid-cols-1 items-stretch gap-[clamp(14px,1.6vw,20px)] md:grid-cols-3">
        {fugas.map((fuga, i) => (
          <article
            key={`${fuga.titulo}-${i}`}
            className="flex min-w-0 flex-col overflow-hidden rounded-[14px] bg-(--d-cardbg)"
          >
            <div className="flex flex-1 flex-col p-[clamp(18px,2.1vw,26px)]">
              <span aria-hidden="true" className="disp text-[1.15rem] leading-none font-bold text-coral">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3.5 text-[clamp(.98rem,1.05vw,1.06rem)] leading-[1.3] font-semibold text-balance text-navy">
                {fuga.titulo}
              </h3>
            </div>
            <div className="bg-navy px-[clamp(18px,2.1vw,26px)] py-4 text-[.88rem] leading-[1.5] text-white/85">
              <b className="mb-1.5 block text-[.64rem] font-bold tracking-[.14em] text-coral uppercase">
                Qué se pierde
              </b>
              {fuga.que_se_pierde}
            </div>
          </article>
        ))}
      </div>
    </Lamina>
  );
}

/** "Resumen, de un vistazo": los cinco canales v1 con la escala de cinco
 *  puntos. Todos salen de chequeos con código; ninguno de v2 entra acá. */
export function ResumenCanales({
  empresa,
  canales,
}: ConEmpresa & { canales: Record<ClaveCanal, CanalInforme> }) {
  return (
    <Lamina
      empresa={empresa}
      kicker="Resumen"
      titulo="Cómo está cada canal, de un vistazo"
      lead="Cinco puntos = profesional y sostenido. Un punto = no existe o está roto."
    >
      <ul>
        {CANALES.map(([clave, rotulo]) => {
          const canal = canales[clave];
          return (
            <li
              key={clave}
              className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5 border-b border-(--d-linea) py-[clamp(10px,1vw,12px)] last:border-b-0 sm:grid-cols-[clamp(170px,18vw,260px)_auto_minmax(0,80ch)]"
            >
              <span className="disp text-[clamp(.92rem,1vw,1rem)] font-semibold text-navy">{rotulo}</span>
              <CincoPuntos canal={canal} />
              <span className="col-span-2 text-[clamp(.84rem,.9vw,.9rem)] leading-[1.4] text-(--d-tinta) sm:col-span-1">
                {canal.insight}
              </span>
            </li>
          );
        })}
      </ul>
    </Lamina>
  );
}

/** Madurez 1 va en coral, como el deck (roto); el resto en magenta. Con
 *  'a_validar' no se pinta ningún punto: no pudimos mirar el canal. */
function CincoPuntos({ canal }: { canal: CanalInforme }) {
  if (canal.estado === "a_validar") return <SinVerificar />;

  const lleno = canal.madurez === 1 ? "bg-coral" : "bg-magenta";
  return (
    <span className="flex gap-[7px]">
      <span className="sr-only">Madurez {canal.madurez} de 5</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          aria-hidden="true"
          className={`h-[clamp(13px,1.15vw,16px)] w-[clamp(13px,1.15vw,16px)] rounded-full ${
            n <= canal.madurez ? lleno : "border-2 border-(--d-ring)"
          }`}
        />
      ))}
    </span>
  );
}

/** "Los pasos, en orden". GATEADO por decisión de producto: se ven el orden
 *  y el título de cada paso, no el detalle, que se cuenta en la llamada. */
export function SeisPasos({ empresa, plan }: ConEmpresa & { plan: PasoPlan[] }) {
  if (plan.length === 0) return null;

  return (
    <Lamina
      tono="dark"
      empresa={empresa}
      kicker="Cómo lo ordenamos"
      titulo={`Los ${plan.length} pasos, en orden`}
      lead="El orden importa: cada paso necesita que el anterior esté hecho."
    >
      {/* Con 4 pasos, 3 columnas dejaban el último solo en una segunda fila;
          a 1500px de lámina se notaba el hueco. 5 o 6 siguen en 3. */}
      <ol
        className={`grid grid-cols-1 gap-[clamp(14px,1.6vw,20px)] sm:grid-cols-2 ${
          plan.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        {plan.map((paso, i) => (
          <li
            key={`${paso.titulo}-${i}`}
            className={`min-w-0 rounded-[14px] p-[clamp(18px,2.1vw,26px)] ${
              i === plan.length - 1 ? "bg-magenta/[.16]" : "bg-white/[.05]"
            }`}
          >
            <div aria-hidden="true" className="disp mb-2.5 text-[clamp(1rem,1.2vw,1.15rem)] font-bold text-magenta">
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3 className="text-[clamp(.96rem,1.08vw,1.08rem)] leading-[1.3] font-semibold text-white">
              {paso.titulo}
            </h3>
          </li>
        ))}
      </ol>
      <div>
        <p className="disp text-[clamp(1.1rem,1.7vw,1.5rem)] leading-[1.25] font-bold text-white">
          La publicidad es el último paso, no el primero.
        </p>
        <p className="mt-2 text-[.88rem] text-white/60">
          Qué se toca en cada paso y qué cambia: eso lo vemos juntos.
        </p>
      </div>
    </Lamina>
  );
}
