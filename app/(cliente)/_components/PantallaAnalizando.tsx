import { Auras } from "./Auras";

/** Pantalla de espera del análisis. La comparten `/analizando/[id]` (después
 *  del submit) y `/d/[token]` (cuando el informe todavía está en pending o
 *  analyzing), para que sea el mismo diseño en los dos lados.
 *
 *  TODO (Fase 3): el checklist es estático. Cuando haya polling de
 *  `diagnostics.status`, los pasos deberían encenderse de verdad. */

const PASOS = [
  "Revisando tu sitio web",
  "Viendo cómo aparecés en Google",
  "Chequeando tu medición",
  "Mirando a tu competencia",
  "Armando tu informe",
];

export function PantallaAnalizando({ pie }: { pie?: React.ReactNode }) {
  return (
    <section className="relative flex flex-1 items-center overflow-hidden bg-dark text-white">
      <Auras />

      <div className="relative z-10 mx-auto w-full max-w-[940px] px-[clamp(18px,5vw,32px)] py-24">
        <span className="font-display text-[2.2rem] leading-[0.7] font-bold text-white">
          *
        </span>

        <h1 className="mt-3.5 max-w-[16ch] text-[clamp(1.8rem,4.5vw,2.7rem)] font-bold text-white">
          Estamos analizando tu presencia digital
        </h1>
        <p className="mt-2.5 max-w-[48ch] text-white/65">
          Esto tarda unos minutos. Podés cerrar la pestaña: te avisamos por mail
          cuando esté listo.
        </p>

        <ul className="mt-9 max-w-[440px]">
          {PASOS.map((paso) => (
            <li
              key={paso}
              className="flex items-center gap-4 border-b border-white/10 py-3.5 opacity-40"
            >
              <span
                aria-hidden="true"
                className="h-[26px] w-[26px] flex-none rounded-full border-2 border-white/30"
              />
              <span className="font-medium">{paso}</span>
            </li>
          ))}
        </ul>

        {pie && <div className="mt-9 text-[0.78rem] text-white/35">{pie}</div>}
      </div>
    </section>
  );
}
