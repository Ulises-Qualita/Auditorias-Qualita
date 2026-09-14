import { Auras } from "../../_components/Auras";
import type {
  NumeroDestacado,
  PasoPlan,
  PasoRecorrido,
} from "@/lib/diagnostico/results";

/** Las láminas de la auditoría de referencia, en componentes.
 *
 *  Todo sale de `results`: no hay un solo número ni frase escrita a mano acá.
 *  Cuando un dato no está, la sección entera no se dibuja —`activos` puede
 *  venir vacío si el sitio no respondió— en vez de mostrar un cero que
 *  mentiría. Server components: no hay estado ni interacción. */

/** "Lo que ya tienen" (pág. 3 del PDF): la lámina de activos.
 *
 *  El dato va grande en Unbounded y la etiqueta abajo, como el ejemplo. Es
 *  deliberado que abra el informe: primero lo que juega a favor. */
export function Activos({ activos }: { activos: NumeroDestacado[] }) {
  if (activos.length === 0) return null;

  return (
    <section className="border-b border-linea bg-crema px-[clamp(18px,5vw,32px)] py-[clamp(38px,6vw,54px)]">
      <div className="mx-auto w-full max-w-[940px]">
        <Kicker>Lo que ya tenés</Kicker>
        <h2 className="mt-3 text-[clamp(1.25rem,2.6vw,1.5rem)] font-semibold text-navy">
          Nada de esto hay que construirlo
        </h2>
        <p className="mt-2 max-w-[54ch] text-[0.94rem] text-tinta">
          Estos datos están verificados. El problema no es lo que falta: es que lo que hay
          todavía no está conectado.
        </p>

        <div className="mt-7 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {activos.map((activo, i) => (
            <div key={`${activo.dato}-${i}`} className="border-t-2 border-magenta/25 pt-4">
              <DatoGrande valor={activo.dato} tono="magenta" />
              <p className="mt-2 text-[0.88rem] leading-[1.45] text-tinta">{activo.etiqueta}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** "El recorrido" (pág. 4): las tarjetas encadenadas del comprador.
 *
 *  `desenlaceCritico` decide si la última tarjeta va en tono de alerta. NO se
 *  deduce del texto del paso —eso sería adivinar leyendo strings— sino del
 *  canal de contacto: si no hay por dónde dejar el dato, el recorrido termina
 *  mal y la tarjeta lo dice. Si el canal está sano, el final no se pinta de
 *  rojo solo porque es el último. */
export function Recorrido({
  pasos,
  desenlaceCritico,
}: {
  pasos: PasoRecorrido[];
  desenlaceCritico: boolean;
}) {
  if (pasos.length === 0) return null;

  return (
    <section className="border-b border-linea px-[clamp(18px,5vw,32px)] py-[clamp(38px,6vw,54px)]">
      <div className="mx-auto w-full max-w-[940px]">
        <Kicker>El recorrido</Kicker>
        <h2 className="mt-3 max-w-[24ch] text-[clamp(1.25rem,2.6vw,1.5rem)] leading-[1.25] font-semibold text-navy">
          Alguien entra a tu sitio con intención de comprar. ¿Dónde deja el dato?
        </h2>

        <ol
          className={`mt-7 grid gap-4 sm:grid-cols-2 ${
            pasos.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
          }`}
        >
          {pasos.map((paso, i) => {
            const esUltimo = i === pasos.length - 1;
            const alerta = esUltimo && desenlaceCritico;

            return (
              <li key={`${paso.paso}-${i}`} className="relative min-w-0">
                <article
                  className={`flex h-full flex-col rounded-card border p-5 shadow-qualita ${
                    alerta ? "border-warn/30 bg-warnbg" : "border-linea bg-white"
                  }`}
                >
                  <span
                    className={`text-[0.66rem] font-bold tracking-[0.14em] uppercase ${
                      alerta ? "text-warn" : "text-coral"
                    }`}
                  >
                    {paso.paso}
                  </span>
                  <p
                    className={`mt-2.5 text-[0.9rem] leading-[1.5] ${
                      alerta ? "text-navy" : "text-tinta"
                    }`}
                  >
                    {paso.detalle}
                  </p>
                </article>

                {/* La cadena: solo en la grilla horizontal. En una columna el
                    orden ya lo da la lectura y una flecha lateral sobraría. */}
                {i < pasos.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -right-[13px] hidden -translate-y-1/2 text-[1.4rem] leading-none text-tinta2 lg:block"
                  >
                    ›
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** "En una página" (pág. 15): la franja de números protagonistas.
 *
 *  Los valores salen tal cual de `cierre.numeros`, que el análisis derivó de
 *  los facts. Van sobre el oscuro de marca con auras, que es donde el ejemplo
 *  pone su lámina de cierre. */
export function EnUnaPagina({
  titular,
  numeros,
}: {
  titular: string;
  numeros: NumeroDestacado[];
}) {
  if (numeros.length === 0) return null;

  return (
    <section className="relative overflow-hidden border-b border-linea bg-dark px-[clamp(18px,5vw,32px)] py-[clamp(42px,7vw,60px)] text-white">
      <Auras />

      <div className="relative z-10 mx-auto w-full max-w-[940px]">
        <span className="flex items-center gap-2.5 text-[0.68rem] font-bold tracking-[0.2em] text-coral uppercase">
          <span aria-hidden="true" className="h-px w-5 flex-none bg-coral" />
          En una página
        </span>

        <h2 className="mt-3 max-w-[26ch] text-[clamp(1.3rem,2.8vw,1.75rem)] leading-[1.25] font-semibold text-balance text-white">
          {titular}
        </h2>

        <div className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {numeros.map((numero, i) => (
            <div key={`${numero.dato}-${i}`} className="min-w-0 border-t border-white/15 pt-4">
              <DatoGrande valor={numero.dato} tono="claro" />
              <p className="mt-2 text-[0.86rem] leading-[1.45] text-white/60">
                {numero.etiqueta}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** "Cómo lo ordenamos" (pág. 14): los pasos del método, en grilla numerada.
 *
 *  Va GATEADO por decisión de producto: se ven el orden y el título de cada
 *  paso, no el detalle. Por eso las tarjetas no muestran `paso.detalle` — el
 *  dato está en `results`, pero el cómo es el trabajo de Qualita. No hay blur
 *  ni texto falso simulando contenido tapado: se ve lo que hay. */
export function PlanGateado({ plan }: { plan: PasoPlan[] }) {
  if (plan.length === 0) return null;

  return (
    <section className="border-b border-linea bg-bg px-[clamp(18px,5vw,32px)] py-[clamp(38px,6vw,54px)]">
      <div className="mx-auto w-full max-w-[940px]">
        <Kicker>Cómo lo ordenamos</Kicker>
        <h2 className="mt-3 text-[clamp(1.25rem,2.6vw,1.5rem)] font-semibold text-navy">
          Los {plan.length} pasos, en orden
        </h2>
        <p className="mt-2 max-w-[54ch] text-[0.94rem] text-tinta">
          El orden importa: cada paso necesita que el anterior esté hecho. La publicidad es
          el último, nunca el primero.
        </p>

        <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plan.map((paso, i) => (
            <li
              key={`${paso.titulo}-${i}`}
              className="flex min-w-0 flex-col rounded-card border border-linea bg-white p-5 shadow-qualita"
            >
              <b
                aria-hidden="true"
                className="font-display text-[1.35rem] leading-none font-bold text-tinta2"
              >
                {String(i + 1).padStart(2, "0")}
              </b>
              <span className="mt-3 text-[0.95rem] leading-[1.4] font-semibold text-navy">
                {paso.titulo}
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-[0.88rem] text-tinta">
          Qué se toca en cada paso, en qué orden y qué cambia: eso lo vemos juntos.
        </p>
      </div>
    </section>
  );
}

/** El número protagonista.
 *
 *  El tamaño se decide por el largo del contenido y no a ojo, porque `dato` no
 *  siempre es un número: el análisis devuelve tanto "0" como "DMARC ausente".
 *  Con un tamaño fijo, el texto largo desbordaba la columna. */
function DatoGrande({ valor, tono }: { valor: string; tono: "magenta" | "claro" }) {
  const largo = valor.trim().length;
  const tamano =
    largo <= 3
      ? "text-[clamp(2.4rem,5vw,3.1rem)]"
      : largo <= 8
        ? "text-[clamp(1.7rem,3.6vw,2.2rem)]"
        : "text-[clamp(1.15rem,2.4vw,1.4rem)]";

  return (
    <b
      className={`font-display block leading-[1.05] font-bold break-words ${tamano} ${
        tono === "magenta" ? "text-magenta" : "text-white"
      }`}
    >
      {valor}
    </b>
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
