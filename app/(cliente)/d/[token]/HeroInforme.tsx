import { Auras } from "../../_components/Auras";
import { nivelDeScore } from "@/lib/diagnostico/results";

type Props = {
  empresa: string;
  rubro: string | null;
  provincia: string | null;
  fecha: string;
  resumen: string;
  scoreGeneral: number | null;
  scoreInfra: number | null;
  /** En v1 siempre null: el pilar Marca no se evalúa. */
  scoreMarca: number | null;
  /** 'preliminary' todavía no pasó por revisión humana. */
  preliminar: boolean;
};

/** Hero oscuro del informe + tarjeta glass de score. Todo lo que muestra sale
 *  del diagnóstico y de la empresa; nada hardcodeado del mockup. */
export function HeroInforme({
  empresa,
  rubro,
  provincia,
  fecha,
  resumen,
  scoreGeneral,
  scoreInfra,
  scoreMarca,
  preliminar,
}: Props) {
  const meta = [rubro, provincia, fecha].filter(Boolean).join(" · ");

  return (
    <section className="relative overflow-hidden bg-dark px-[clamp(18px,5vw,32px)] py-[clamp(48px,8vw,72px)] text-white">
      <Auras />
      <span
        aria-hidden="true"
        className="font-display absolute top-9 right-[7%] z-[2] text-[2rem] leading-[0.7] font-bold text-white/20"
      >
        *
      </span>

      <div className="relative z-10 mx-auto grid w-full max-w-[940px] items-center gap-11 lg:grid-cols-[1.25fr_0.95fr]">
        <div>
          <Kicker>{preliminar ? "Tu diagnóstico preliminar" : "Tu diagnóstico está listo"}</Kicker>

          <h1 className="mt-4 text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.02] font-bold text-white">
            {empresa}
          </h1>

          <p className="mt-3.5 max-w-[42ch] text-[1.05rem] text-white/75">{resumen}</p>

          {meta && <p className="mt-3.5 text-[0.85rem] text-white/45">{meta}</p>}

          {preliminar && (
            <p className="mt-5 max-w-[46ch] rounded-[12px] border border-white/15 bg-white/[0.06] px-4 py-3 text-[0.82rem] text-white/70">
              Informe preliminar: el equipo de Qualita todavía lo está revisando.
              Puede cambiar antes de la versión final.
            </p>
          )}
        </div>

        <PanelScore
          scoreGeneral={scoreGeneral}
          scoreInfra={scoreInfra}
          scoreMarca={scoreMarca}
        />
      </div>
    </section>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 text-[0.68rem] font-bold tracking-[0.2em] text-coral uppercase">
      <span aria-hidden="true" className="h-px w-5 flex-none bg-coral" />
      {children}
    </span>
  );
}

/** Tarjeta glass: score general sobre la escala Inicial → Sólido, más el
 *  desglose por pilar. Marca no tiene número en v1 y no se lo inventamos. */
function PanelScore({
  scoreGeneral,
  scoreInfra,
  scoreMarca,
}: Pick<Props, "scoreGeneral" | "scoreInfra" | "scoreMarca">) {
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
        <div className="mb-[22px]">
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

      <div className="flex flex-col gap-4 border-t border-white/10 pt-5">
        <FilaPilar
          nombre="Marca implementadora"
          color="bg-magenta"
          score={scoreMarca}
          barra="linear-gradient(90deg, #d95cf5, #a915c4)"
        />
        <FilaPilar
          nombre="Infraestructura digital"
          color="bg-coral"
          score={scoreInfra}
          barra="linear-gradient(90deg, #ff9084, #FE6F61)"
        />
      </div>
    </div>
  );
}

/** Sin score, la fila muestra el chip "A validar" en vez de una barra en cero:
 *  un cero se leería como "mal", y lo que pasa es que todavía no se midió. */
function FilaPilar({
  nombre,
  color,
  score,
  barra,
}: {
  nombre: string;
  color: string;
  score: number | null;
  barra: string;
}) {
  return (
    <div>
      <div className="mb-[7px] flex items-center gap-2.5 text-[0.86rem] text-white/85">
        <span aria-hidden="true" className={`h-2.5 w-2.5 flex-none rounded-[3px] ${color}`} />
        <span>{nombre}</span>
        {score === null ? (
          <span className="ml-auto rounded-full bg-white/10 px-2.5 py-[3px] text-[0.62rem] font-bold tracking-[0.08em] text-white/55 uppercase">
            A validar
          </span>
        ) : (
          <b className="font-display ml-auto text-[0.98rem] font-bold text-white">{score}</b>
        )}
      </div>
      {score !== null && (
        <span className="block h-2 overflow-hidden rounded-md bg-white/10">
          <i
            className="block h-full min-w-2.5 rounded-md"
            style={{ width: `${score}%`, background: barra }}
          />
        </span>
      )}
    </div>
  );
}
