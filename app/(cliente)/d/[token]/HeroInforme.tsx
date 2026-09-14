import Image from "next/image";

import { nivelDeScore } from "@/lib/diagnostico/results";

type Props = {
  empresa: string;
  rubro: string | null;
  provincia: string | null;
  /** Fecha completa del diagnóstico ("11 de septiembre de 2026"). */
  fecha: string;
  /** La tesis de portada, en dos golpes, como la auditoría: el titular es el
   *  hecho, la bajada es dónde está el problema. */
  tesis: { titular: string; bajada: string };
  scoreGeneral: number | null;
  /** 'preliminary' todavía no pasó por revisión humana. */
  preliminar: boolean;
};

/** Portada del informe: la lámina de tapa del deck de referencia
 *  (docs/referencia-diseno-informe.html) —gradiente, isotipo, kicker, el
 *  nombre de la empresa en grande, la tesis, la nota de método y la fecha—
 *  con la tarjeta glass de puntaje a la derecha.
 *
 *  Va dentro del Mazo, como la primera lámina: toma de ahí Poppins y el
 *  ancho. La tarjeta de puntaje (PanelScore) no cambió.
 *
 *  Los textos de la tesis los escribe el modelo, así que su largo no está
 *  garantizado por más que el prompt pida frases cortas: el tope se aplica
 *  ACÁ, en el render, en dos capas —recorte por caracteres y `line-clamp`—.
 *  La primera controla el contenido y la segunda ataja lo que igual desborde a
 *  un ancho chico, donde se da una línea más. */
export function HeroInforme({
  empresa,
  rubro,
  provincia,
  fecha,
  tesis,
  scoreGeneral,
  preliminar,
}: Props) {
  const titular = acortar(tesis.titular, 68);
  const bajada = acortar(tesis.bajada, 130);
  const pie = [fecha && `Verificado el ${fecha}`, rubro, provincia].filter(Boolean).join(" · ");

  return (
    <section
      className="lamina relative overflow-hidden rounded-2xl p-[clamp(26px,4.4vw,58px)] text-white shadow-[0_10px_40px_rgba(37,40,81,.12)] lg:min-h-[560px]"
      style={{ background: "linear-gradient(120deg, #241d47 0%, #3a1c66 45%, #a012bf 100%)" }}
    >
      {/* Texto y puntaje forman un solo bloque centrado en la portada. Con la
          columna de texto en 1fr, los textos (topados en 30-62 caracteres) no
          llegaban a llenarla y la tarjeta quedaba contra el borde derecho, con
          ~300px vacíos en el medio. Las dos columnas tienen ancho tope: la del
          puntaje para que el número no se pierda en el vidrio. */}
      {/* fit-content: la columna mide lo que mide su texto más ancho, hasta
          620px. Con un ancho fijo quedaba aire muerto adentro de la columna
          (los topes de los textos van en `ch` y se achican con la fuente), y
          se sumaba al gap: a 1280px el hueco llegaba a 122px. */}
      <div className="grid h-full items-center gap-[clamp(28px,4vw,64px)] lg:grid-cols-[fit-content(620px)_minmax(340px,440px)] lg:justify-center">
        {/* min-w-0: sin esto, un ítem de grid usa `min-width: auto` y una
            palabra larga (un dominio, por ejemplo) ensancha la columna en vez
            de cortarse, y la portada desborda a lo ancho. */}
        <div className="min-w-0">
          <Image
            src="/qualita-isotipo.png"
            alt=""
            width={488}
            height={503}
            priority
            className="mb-[clamp(18px,2.4vw,26px)] h-[clamp(52px,6vw,80px)] w-auto"
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[clamp(.66rem,.82vw,.78rem)] font-bold tracking-[.15em] text-white uppercase">
              Qualita Studio · Diagnóstico digital
            </span>
            {/* Que el informe no esté revisado hay que decirlo, sin sumar un
                párrafo a la portada. */}
            {preliminar && (
              <span className="rounded-full border border-white/20 bg-white/[0.08] px-2.5 py-1 text-[0.66rem] font-semibold tracking-[0.06em] text-white/75 uppercase">
                En revisión
              </span>
            )}
          </div>

          <h1 className="mt-2 text-[clamp(2.2rem,5.2vw,5rem)] leading-[1.02] font-extrabold text-balance break-words hyphens-auto text-white">
            {empresa}
          </h1>

          <p className="mt-[clamp(16px,2.2vw,26px)] line-clamp-3 max-w-[30ch] text-[clamp(1.15rem,2vw,1.6rem)] leading-[1.25] text-pretty text-white/90 sm:line-clamp-2">
            {titular}
          </p>
          <p className="mt-2.5 line-clamp-3 max-w-[48ch] text-[clamp(.92rem,1.1vw,1.02rem)] leading-[1.45] text-pretty text-white/70 sm:line-clamp-2">
            {bajada}
          </p>

          <p className="mt-[clamp(18px,2.4vw,28px)] max-w-[62ch] text-[clamp(.78rem,.95vw,.88rem)] leading-[1.55] text-white/60">
            Todo lo que sigue sale del código de tu sitio y del registro de tu dominio,
            verificado uno por uno. Lo que no se pudo verificar, se dice.
          </p>
          {pie && (
            <p className="mt-4 text-[clamp(.7rem,.82vw,.8rem)] text-white/50">{pie}</p>
          )}
        </div>

        <PanelScore scoreGeneral={scoreGeneral} />
      </div>
    </section>
  );
}

/** Recorta en el último espacio antes del tope para no cortar una palabra al
 *  medio. Si no hay espacio (una sola palabra larguísima), corta duro. */
function acortar(texto: string, maximo: number): string {
  const limpio = texto.trim();
  if (limpio.length <= maximo) return limpio;

  const recorte = limpio.slice(0, maximo);
  const ultimoEspacio = recorte.lastIndexOf(" ");
  const base = ultimoEspacio > maximo * 0.6 ? recorte.slice(0, ultimoEspacio) : recorte;

  // Sin puntuación colgando antes de los puntos suspensivos.
  return `${base.replace(/[.,;:\s]+$/, "")}…`;
}

/** Tarjeta glass: score general sobre la escala Inicial → Sólido.
 *
 *  Ya no hay desglose por pilar: hay un solo pilar (Arquitectura digital) y su
 *  score ES el general, así que repetirlo era ruido. El detalle por canal vive
 *  en su propia sección, con la escala de cinco puntos de la auditoría. */
function PanelScore({ scoreGeneral }: Pick<Props, "scoreGeneral">) {
  const nivel = scoreGeneral === null ? null : nivelDeScore(scoreGeneral);

  return (
    <div className="rounded-[20px] border border-white/15 bg-white/[0.06] p-[26px] backdrop-blur-md">
      <div className="mb-6 flex items-center gap-[18px]">
        <div className="flex items-baseline gap-0.5">
          <b className="font-display text-[3.6rem] leading-[0.85] font-bold text-white">
            {scoreGeneral ?? "—"}
          </b>
          <span className="text-[1rem] font-semibold text-white/50">/100</span>
        </div>
        <div className="text-[0.85rem] text-white/60">
          Madurez digital
          <br />
          {nivel ? (
            <span
              className={`mt-[7px] inline-block rounded-full px-[11px] py-1 text-[0.68rem] font-bold tracking-[0.07em] uppercase ${nivel.claseOscura}`}
            >
              Nivel {nivel.label}
            </span>
          ) : (
            <span className="mt-[7px] inline-block rounded-full bg-white/10 px-[11px] py-1 text-[0.68rem] font-bold tracking-[0.07em] text-white/60 uppercase">
              Sin calcular
            </span>
          )}
        </div>
      </div>

      {scoreGeneral !== null && (
        <div>
          <div
            className="relative h-2 rounded-[5px]"
            style={{
              background:
                "linear-gradient(90deg, rgba(224,73,47,.7), rgba(181,116,0,.7) 55%, rgba(31,157,99,.7))",
            }}
          >
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-coral bg-white shadow-[0_2px_10px_rgba(0,0,0,.4)]"
              style={{ left: `${scoreGeneral}%` }}
            />
          </div>
          <div className="mt-2.5 flex justify-between text-[0.64rem] text-white/40">
            <span>Inicial</span>
            <span>En desarrollo</span>
            <span>Sólido</span>
          </div>
        </div>
      )}
    </div>
  );
}
