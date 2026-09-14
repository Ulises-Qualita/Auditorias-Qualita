import Link from "next/link";
import { Auras } from "./_components/Auras";

/** Landing de la vista empresa. Versión corta a propósito: hero, tres pasos y
 *  el cierre. Todo lo que promete es lo que el diagnóstico realmente hace hoy
 *  (sitio, Google, medición); las redes todavía no se piden ni se analizan. */
export default function Landing() {
  return (
    <>
      <section className="relative overflow-hidden bg-dark px-[clamp(18px,5vw,32px)] py-[clamp(56px,10vw,96px)] text-white">
        <Auras />
        <span
          aria-hidden="true"
          className="font-display absolute top-10 right-[7%] z-[2] text-[2.2rem] leading-[0.7] font-bold text-white/20"
        >
          *
        </span>

        <div className="relative z-10 mx-auto w-full max-w-[940px]">
          <Kicker>Autodiagnóstico digital · gratis</Kicker>

          <h1 className="font-display mt-[18px] max-w-[16ch] text-[clamp(2.1rem,5vw,3.4rem)] leading-[1.03] font-bold">
            ¿Dónde se te escapan las consultas?
          </h1>

          <p className="mt-4 max-w-[52ch] text-[1.05rem] text-white/75">
            Revisamos tu sitio, las formas de contactarte, lo que Google lee de tu
            página y si estás midiendo lo que pasa. Te devolvemos un informe claro,
            con lo que está bien y lo que te está costando consultas.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/diagnostico"
              className="inline-flex items-center gap-2 rounded-full bg-[image:var(--grad)] px-7 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_6px_18px_rgba(181,12,197,.32)] transition hover:-translate-y-px"
            >
              Empezar mi diagnóstico <Flecha />
            </Link>
          </div>

          <p className="mt-5 text-[0.82rem] text-white/45">
            Sin costo · usamos solo información pública · no pedimos accesos ni
            contraseñas
          </p>
        </div>
      </section>

      <section className="px-[clamp(18px,5vw,32px)] py-[clamp(48px,8vw,72px)]">
        <div className="mx-auto w-full max-w-[940px]">
          <KickerClaro>Cómo funciona</KickerClaro>
          <h2 className="font-display mt-2.5 text-[clamp(1.5rem,3vw,2rem)] font-semibold text-navy">
            Tres pasos, cero fricción
          </h2>

          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {PASOS.map((paso, indice) => (
              <li
                key={paso.titulo}
                className="rounded-[16px] border border-linea bg-white p-6 shadow-[0_1px_2px_rgba(37,40,81,.04),0_6px_18px_rgba(37,40,81,.05)]"
              >
                <span className="font-display inline-flex h-9 w-9 items-center justify-center rounded-full bg-[image:var(--grad)] text-[0.95rem] font-bold text-white">
                  {indice + 1}
                </span>
                <h3 className="mt-4 text-[1.02rem] font-semibold text-navy">
                  {paso.titulo}
                </h3>
                <p className="mt-1.5 text-[0.92rem] text-tinta">{paso.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-[clamp(18px,5vw,32px)] pb-[clamp(56px,9vw,88px)]">
        <div className="relative mx-auto w-full max-w-[940px] overflow-hidden rounded-[20px] bg-dark px-[clamp(24px,5vw,48px)] py-[clamp(40px,6vw,56px)] text-white">
          <Auras />
          <div className="relative z-10">
            <span
              aria-hidden="true"
              className="font-display block text-[1.8rem] leading-none font-bold text-white/70"
            >
              *
            </span>
            <h2 className="font-display mt-3 max-w-[20ch] text-[clamp(1.5rem,3vw,2.1rem)] leading-tight font-semibold">
              Empezá por saber dónde estás parado
            </h2>
            <p className="mt-3 max-w-[46ch] text-white/70">
              El diagnóstico es gratis. Lo que hagas con él, lo decidís vos.
            </p>
            <Link
              href="/diagnostico"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[0.95rem] font-semibold text-navy transition hover:-translate-y-px"
            >
              Empezar mi diagnóstico <Flecha />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

const PASOS = [
  {
    titulo: "Cargás tus datos",
    texto: "Nombre, sitio y rubro. Un formulario corto, de dos minutos.",
  },
  {
    titulo: "Analizamos",
    texto:
      "Tu sitio, sus vías de contacto, lo que lee Google y si tenés medición andando.",
  },
  {
    titulo: "Recibís tu informe",
    texto:
      "El estado de cada canal y por dónde se te están yendo las consultas.",
  },
];

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 text-[0.68rem] font-bold tracking-[0.2em] text-coral uppercase">
      <span aria-hidden="true" className="h-px w-5 flex-none bg-coral" />
      {children}
    </span>
  );
}

function KickerClaro({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 text-[0.7rem] font-bold tracking-[0.2em] text-magenta uppercase">
      <span aria-hidden="true" className="h-0.5 w-5 flex-none rounded-sm bg-coral" />
      {children}
    </span>
  );
}

function Flecha() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
