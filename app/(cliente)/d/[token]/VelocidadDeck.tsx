import type { CategoriaVelocidad, VelocidadInforme } from "@/lib/diagnostico/hechos";
import { Banda, Lamina, Punto, Tarjeta } from "./Deck";

/** "Velocidad y calidad técnica": los 4 puntajes de PageSpeed Insights y las
 *  mejoras que marca Lighthouse, dichas en lenguaje llano.
 *
 *  Todo sale de hechos medidos por Google (lib/diagnostico/hechos.ts), nada del
 *  modelo: los números son los de PageSpeed y los textos de las mejoras están
 *  fijos en lib/diagnostico/mejorasPageSpeed.ts.
 *
 *  Nada de donas (lo pide la guía de marca): cada puntaje va con una barra y
 *  el rango de Google, así el número tiene contexto. */

const CATEGORIAS: Array<{ id: CategoriaVelocidad; nombre: string; paraQue: string }> = [
  { id: "rendimiento", nombre: "Velocidad", paraQue: "Cuánto tarda en abrir desde un celular." },
  { id: "accesibilidad", nombre: "Accesibilidad", paraQue: "Que cualquiera lo pueda leer y usar." },
  { id: "practicas", nombre: "Buenas prácticas", paraQue: "Seguridad y código al día." },
  { id: "seo", nombre: "SEO técnico", paraQue: "Lo básico para que Google lo lea bien." },
];

const NOMBRE_CATEGORIA: Record<CategoriaVelocidad, string> = {
  rendimiento: "Velocidad",
  accesibilidad: "Accesibilidad",
  practicas: "Buenas prácticas",
  seo: "SEO técnico",
};

const CALIFICACION_REAL = { FAST: "rápida", AVERAGE: "mejorable", SLOW: "lenta" } as const;

/** Los rangos de Google para los puntajes de Lighthouse. */
function rango(puntaje: number): { etiqueta: string; texto: string; barra: string } {
  if (puntaje >= 90) return { etiqueta: "Bien", texto: "text-ok", barra: "bg-ok" };
  if (puntaje >= 50) return { etiqueta: "Mejorable", texto: "text-mid", barra: "bg-mid" };
  return { etiqueta: "Bajo", texto: "text-warn", barra: "bg-warn" };
}

export function Velocidad({ empresa, velocidad }: { empresa: string; velocidad: VelocidadInforme }) {
  const { puntajes, reales, mejoras } = velocidad;
  const rendimiento = puntajes.rendimiento;

  const titulo =
    rendimiento === null
      ? "Cómo ve Google tu sitio en un celular"
      : `Google le pone ${rendimiento} de 100 a la velocidad de tu sitio en celular`;

  const lead = reales?.categoria
    ? `Con visitantes reales de los últimos 28 días, Google califica la carga como ${
        CALIFICACION_REAL[reales.categoria]
      }${
        reales.lcpMs === null ? "" : `: a la mayoría el contenido principal le aparece en ${segundos(reales.lcpMs)}`
      }${reales.deTodoElDominio ? " (dato del sitio entero, no solo de la home)" : ""}. Los puntajes de abajo son la prueba de laboratorio de Google, simulando un celular.`
    : "Es la prueba de Google simulando un celular. Tu sitio todavía no tiene visitas suficientes para que Google publique datos de usuarios reales.";

  const fecha = fechaMedicion(velocidad.medidoEn);

  return (
    <Lamina empresa={empresa} kicker="Velocidad y calidad técnica" titulo={titulo} lead={lead}>
      <div className="grid grid-cols-1 gap-[clamp(14px,1.6vw,20px)] sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIAS.map((categoria) => {
          const puntaje = puntajes[categoria.id];
          const r = puntaje === null ? null : rango(puntaje);
          return (
            <Tarjeta key={categoria.id}>
              <p className="text-[clamp(.78rem,.86vw,.84rem)] font-bold tracking-[.06em] text-navy uppercase">
                {categoria.nombre}
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <b
                  className={`disp text-[clamp(2rem,3.4vw,2.9rem)] leading-none font-bold ${
                    r ? r.texto : "text-(--d-tinta2)"
                  }`}
                >
                  {puntaje ?? "—"}
                </b>
                {r && (
                  <span className={`text-[clamp(.74rem,.8vw,.8rem)] font-bold ${r.texto}`}>{r.etiqueta}</span>
                )}
              </p>
              {puntaje !== null && r && (
                <div
                  role="img"
                  aria-label={`${categoria.nombre}: ${puntaje} de 100, ${r.etiqueta.toLowerCase()}`}
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--d-ring)"
                >
                  <div className={`h-full rounded-full ${r.barra}`} style={{ width: `${puntaje}%` }} />
                </div>
              )}
              <p className="mt-3 text-[clamp(.82rem,.9vw,.88rem)] leading-[1.45] text-(--d-tinta)">
                {categoria.paraQue}
              </p>
            </Tarjeta>
          );
        })}
      </div>

      <p className="text-[.8rem] text-(--d-tinta2)">
        Rangos de Google: 90 a 100 bien · 50 a 89 mejorable · 0 a 49 bajo.
      </p>

      {mejoras.length > 0 ? (
        <>
          <h3 className="mt-2 text-[clamp(1.05rem,1.5vw,1.3rem)] font-bold text-navy">
            Qué se puede mejorar
          </h3>
          <ul className="flex flex-col gap-[clamp(14px,1.7vw,22px)]">
            {mejoras.map((mejora) => (
              <li
                key={mejora.grupo}
                // Mismo tope de ~72 caracteres que el checklist de SeccionesDeck.
                className="grid grid-cols-1 items-start gap-1.5 md:grid-cols-[clamp(220px,24vw,340px)_minmax(0,72ch)] md:gap-8"
              >
                <div
                  className={`disp flex flex-wrap items-center gap-x-3 gap-y-1 text-[clamp(.94rem,1.05vw,1.02rem)] leading-[1.3] font-semibold ${
                    mejora.grave ? "text-coral" : "text-navy"
                  }`}
                >
                  <Punto variante={mejora.grave ? "coral" : "magenta"} />
                  {mejora.titulo}
                </div>
                <p className="pl-6 text-[clamp(.86rem,.94vw,.92rem)] leading-[1.5] text-(--d-tinta) md:pl-0">
                  <span className="mr-2 inline-block rounded-full bg-(--d-cardbg) px-2 py-0.5 align-[1px] text-[.62rem] font-bold tracking-[.08em] text-(--d-tinta2) uppercase">
                    {NOMBRE_CATEGORIA[mejora.categoria]}
                  </span>
                  {mejora.detalle}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Banda>En esta medición, Google no marcó mejoras importantes para el sitio.</Banda>
      )}

      <p className="text-[.8rem] text-(--d-tinta2)">
        Medido con PageSpeed Insights, la herramienta de Google{fecha ? `, el ${fecha}` : ""}. Los
        puntajes varían unos puntos entre una medición y otra.
      </p>
    </Lamina>
  );
}

function segundos(ms: number): string {
  return `${(ms / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} s`;
}

function fechaMedicion(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}
