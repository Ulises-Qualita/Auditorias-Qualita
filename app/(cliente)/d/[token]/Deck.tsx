import Image from "next/image";
import { Poppins } from "next/font/google";

/** Primitivas de las láminas del informe, calcadas de
 *  docs/referencia-diseno-informe.html: mismas superficies (clara y navy;
 *  la portada es el hero del informe, que no se toca), mismo kicker, mismo
 *  pie con la marca.
 *
 *  Diferencia deliberada con el deck: acá NO hay `aspect-ratio: 16/9`. El
 *  deck es un documento armado a mano con textos medidos; acá los textos los
 *  escribe el modelo y su largo varía, así que un alto fijo desbordaría, y en
 *  el celular un 16:9 quedaría ilegible. La lámina crece con su contenido. */

// Poppins solo para las láminas: `next/font` la scopea a donde se usa la
// variable, así que el resto del sitio no la descarga ni la hereda.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

/** El fondo gris del deck, con las láminas encimadas como tarjetas. */
export function Mazo({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${poppins.variable} mazo bg-[#e7e7ee] px-[clamp(10px,3vw,32px)] py-[clamp(18px,4vw,32px)]`}>
      <div className="mx-auto flex w-full max-w-(--ancho-informe) flex-col gap-[clamp(14px,2.4vw,28px)]">
        {children}
      </div>
    </div>
  );
}

export type Tono = "light" | "dark";

const FONDO: Record<Tono, string> = {
  light: "bg-white text-navy",
  dark: "bg-navy text-white",
};

export function Lamina({
  tono = "light",
  empresa,
  kicker,
  titulo,
  lead,
  children,
}: {
  tono?: Tono;
  /** Para el pie: "Qualita Studio para {empresa}". */
  empresa: string;
  kicker: string;
  titulo: React.ReactNode;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  const oscuro = tono === "dark";

  return (
    <section
      className={`lamina relative flex flex-col gap-[clamp(12px,1.6vw,20px)] rounded-2xl p-[clamp(22px,4.4vw,58px)] shadow-[0_10px_40px_rgba(37,40,81,.12)] ${FONDO[tono]}`}
    >
      <span
        className={`text-[clamp(.66rem,.82vw,.78rem)] font-bold tracking-[.15em] uppercase ${
          oscuro ? "text-coral" : "text-magenta"
        }`}
      >
        {kicker}
      </span>
      <h2
        className={`max-w-[30ch] text-[clamp(1.4rem,2.6vw,2.9rem)] leading-[1.14] font-bold text-balance ${
          oscuro ? "text-white" : "text-navy"
        }`}
      >
        {titulo}
      </h2>
      {lead && (
        <p
          className={`max-w-[64ch] text-[clamp(.9rem,1.15vw,1.02rem)] leading-[1.5] text-pretty ${
            oscuro ? "text-white/75" : "text-(--d-tinta)"
          }`}
        >
          {lead}
        </p>
      )}

      <div className="mt-[clamp(8px,1.2vw,14px)] flex flex-col gap-[clamp(14px,1.8vw,22px)]">
        {children}
      </div>

      <PieLamina empresa={empresa} oscuro={oscuro} />
    </section>
  );
}

function PieLamina({ empresa, oscuro }: { empresa: string; oscuro: boolean }) {
  return (
    <div
      className={`mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-[clamp(18px,2vw,26px)] text-[clamp(.66rem,.74vw,.74rem)] ${
        oscuro ? "text-white/45" : "text-(--d-tinta2)"
      }`}
    >
      <span className="min-w-0 break-words">
        Qualita Studio para {empresa} · hola@qualita.studio
      </span>
      <Image
        src={oscuro ? "/qualita-logo-blanco.svg" : "/Logo-nuevo.png"}
        alt="Qualita Studio"
        width={1140}
        height={299}
        className="h-5 w-auto"
      />
    </div>
  );
}

/** Tarjeta gris del deck (o translúcida sobre oscuro). */
export function Tarjeta({
  oscuro = false,
  className = "",
  children,
}: {
  oscuro?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-[14px] p-[clamp(16px,1.9vw,24px)] ${
        oscuro ? "bg-white/[.05]" : "bg-(--d-cardbg)"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Banda de conclusión: gris en claro, navy como `darkbar`. */
export function Banda({
  variante = "gris",
  children,
}: {
  variante?: "gris" | "navy";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[14px] p-[clamp(18px,2vw,26px)] text-[clamp(.92rem,1.1vw,1.05rem)] leading-[1.5] ${
        variante === "navy" ? "bg-navy text-white" : "bg-(--d-cardbg) font-bold text-navy"
      }`}
    >
      {children}
    </div>
  );
}

/** El tamaño del dato grande de UNA grilla de tiles.
 *
 *  Se decide por el dato más largo del grupo y se aplica a todos: si cada tile
 *  eligiera el suyo, "14 páginas" y "3 de 4 vías" quedaban de tamaños
 *  distintos lado a lado por una letra de diferencia. El largo importa porque
 *  el dato no siempre es un número ("A confirmar", "Correo protegido") y a
 *  tamaño de número el texto largo desborda la columna. */
export function tamanoDeGrupo(datos: string[]): string {
  const largo = Math.max(0, ...datos.map((dato) => dato.trim().length));
  if (largo <= 4) return "text-[clamp(2rem,3.4vw,2.9rem)]";
  // Hasta 18 ("Correo protegido") entra a tamaño medio: si no cabe en una
  // línea, parte entre palabras, que se lee mejor que bajar toda la grilla.
  if (largo <= 18) return "text-[clamp(1.4rem,2.4vw,2rem)]";
  return "text-[clamp(1.15rem,1.8vw,1.45rem)]";
}

/** El dato grande de los tiles, con el tamaño de su grupo. */
export function DatoGrande({
  valor,
  tamano,
  tono = "magenta",
}: {
  valor: string;
  /** El que devuelve `tamanoDeGrupo` para la grilla entera. */
  tamano: string;
  tono?: "magenta" | "coral" | "navy";
}) {
  const color = { magenta: "text-magenta", coral: "text-coral", navy: "text-navy" }[tono];

  return (
    <b className={`disp block leading-[1.05] font-bold break-words ${tamano} ${color}`}>{valor}</b>
  );
}

/** Para un canal o un bloque que no se pudo mirar. No es una ausencia: es que
 *  no lo verificamos, y el informe lo dice con todas las letras. */
export function SinVerificar() {
  return (
    <span className="self-start rounded-full bg-infobg px-3 py-1 text-[.68rem] font-bold tracking-[.08em] text-info uppercase">
      Sin verificar
    </span>
  );
}

export type VariantePunto = "coral" | "magenta" | "gris" | "vacio" | "duda";

/** El punto de las filas del deck (`ldot`). "duda" es nuestro, no está en el
 *  deck: un aro punteado para lo que NO vimos en el HTML inicial. El deck usa
 *  el aro vacío para "no existe", y eso acá sería afirmar una ausencia que no
 *  verificamos. El aro vacío queda solo para ausencias que sí son un hecho. */
export function Punto({
  variante,
  tamano = "sm",
}: {
  variante: VariantePunto;
  tamano?: "sm" | "lg";
}) {
  const medida = tamano === "lg" ? "h-[clamp(18px,1.6vw,22px)] w-[clamp(18px,1.6vw,22px)]" : "h-3 w-3";
  const estilo = {
    coral: "bg-coral",
    magenta: "bg-magenta",
    gris: "bg-(--d-gris)",
    vacio: "border-2 border-(--d-ring)",
    duda: "border-2 border-dashed border-mid",
  }[variante];

  return <span aria-hidden="true" className={`inline-block flex-none rounded-full ${medida} ${estilo}`} />;
}
