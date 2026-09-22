import type {
  Arquitectura as ArquitecturaResults,
  Competidor,
  FichaGoogle,
  PaginaInterna,
  Ranking,
  RedSocial,
} from "@/lib/diagnostico/results";
import { Banda, Lamina, SinVerificar, Tarjeta } from "./Deck";

/** Las láminas que salen de la investigación con búsqueda web: arquitectura,
 *  páginas internas, posiciones en Google, marca pública y mapa del sector.
 *  Siguen las láminas equivalentes de docs/referencia-diseno-informe.html.
 *
 *  Todas son opcionales por diseño: un diagnóstico sin búsqueda —o con un
 *  bloque que la búsqueda no pudo cerrar— simplemente no las dibuja. Ninguna
 *  inventa un estado: lo que el análisis marcó "a_validar" se muestra como
 *  pendiente, nunca como ausencia. */

type ConEmpresa = { empresa: string };

/** Para una celda o un bloque que el análisis no pudo verificar. Es lo que
 *  reemplaza al dato: nunca un cero ni un "no tiene". */
function AValidar({ children }: { children?: React.ReactNode }) {
  return (
    <span className="text-(--d-tinta2)">{children ?? "A validar"}</span>
  );
}

/* ---------------------------------------------------------------- */
/* Arquitectura: cómo piensa la empresa vs. cómo busca el comprador  */
/* ---------------------------------------------------------------- */

export function ArquitecturaSitio({
  empresa,
  arquitectura,
}: ConEmpresa & { arquitectura: ArquitecturaResults }) {
  const pendiente = arquitectura.estado === "a_validar";

  return (
    <Lamina
      empresa={empresa}
      kicker="Arquitectura"
      titulo="Cómo está ordenado el sitio y cómo busca el que compra"
      lead="El sitio se puede ordenar por cómo está organizada la empresa o por cómo busca el comprador. Cuando no coinciden, la consulta se pierde en el medio."
    >
      {pendiente && <SinVerificar />}

      <div className="grid grid-cols-1 gap-[clamp(14px,1.6vw,20px)] md:grid-cols-2">
        <Tarjeta>
          <h3 className="disp mb-2.5 text-[clamp(.9rem,1vw,.98rem)] font-semibold text-navy">
            El sitio hoy
          </h3>
          <p className="text-[clamp(.88rem,.96vw,.94rem)] leading-[1.5] text-(--d-tinta)">
            {arquitectura.como_esta_ordenado}
          </p>
        </Tarjeta>
        <Tarjeta>
          <h3 className="disp mb-2.5 text-[clamp(.9rem,1vw,.98rem)] font-semibold text-navy">
            Cómo llega el comprador
          </h3>
          <p className="text-[clamp(.88rem,.96vw,.94rem)] leading-[1.5] text-(--d-tinta)">
            {arquitectura.como_busca_el_comprador}
          </p>
        </Tarjeta>
      </div>

      {arquitectura.brecha && <Banda>{arquitectura.brecha}</Banda>}
    </Lamina>
  );
}

/* ---------------------------------------------------------------- */
/* Páginas internas: cómo se presenta cada página en Google          */
/* ---------------------------------------------------------------- */

export function PaginasInternas({
  empresa,
  paginas,
}: ConEmpresa & { paginas: PaginaInterna[] }) {
  if (paginas.length === 0) return null;

  return (
    <Lamina
      empresa={empresa}
      kicker="Página por página"
      titulo={
        paginas.length === 1
          ? "Cómo se presenta esa página cuando alguien la encuentra"
          : `Cómo se presentan ${paginas.length} páginas de tu sitio`
      }
      lead="Esto es lo que Google tiene guardado de cada página: el título y la descripción que muestra cuando aparece en los resultados. Es lo primero que lee alguien que todavía no entró."
    >
      <ul className="flex flex-col">
        {paginas.map((pagina, i) => (
          <li
            key={`${pagina.url}-${i}`}
            className="grid grid-cols-1 gap-x-8 gap-y-2 border-b border-(--d-linea) py-[clamp(14px,1.6vw,20px)] last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div className="min-w-0">
              <p className="disp text-[clamp(.92rem,1vw,1rem)] leading-[1.3] font-semibold break-words text-navy">
                {pagina.titulo ?? <AValidar>Título sin verificar</AValidar>}
              </p>
              <p className="mt-1 text-[clamp(.76rem,.84vw,.82rem)] break-all text-(--d-tinta2)">
                {rutaVisible(pagina.url)}
              </p>
              {pagina.descripcion ? (
                <p className="mt-2 text-[clamp(.84rem,.9vw,.9rem)] leading-[1.5] text-(--d-tinta)">
                  {pagina.descripcion}
                </p>
              ) : (
                <p className="mt-2 text-[clamp(.84rem,.9vw,.9rem)] leading-[1.5]">
                  <AValidar>No le encontramos descripción en los resultados de Google.</AValidar>
                </p>
              )}
            </div>
            <p className="text-[clamp(.86rem,.94vw,.92rem)] leading-[1.5] text-(--d-tinta) md:border-l md:border-(--d-linea) md:pl-8">
              {pagina.estado === "a_validar" ? (
                <AValidar>{pagina.hallazgo}</AValidar>
              ) : (
                pagina.hallazgo
              )}
            </p>
          </li>
        ))}
      </ul>
    </Lamina>
  );
}

/** La ruta sin el dominio, que es lo que distingue una página de otra. */
function rutaVisible(url: string): string {
  try {
    const parseada = new URL(url);
    const ruta = `${parseada.pathname}${parseada.search}`.replace(/\/$/, "");
    return ruta === "" ? parseada.hostname : ruta;
  } catch {
    return url;
  }
}

/* ---------------------------------------------------------------- */
/* Posiciones en Google                                              */
/* ---------------------------------------------------------------- */

const APARECE: Record<Ranking["aparece"], { texto: string; clase: string }> = {
  si: { texto: "Aparece", clase: "text-ok" },
  no: { texto: "No aparece", clase: "text-warn" },
  no_concluyente: { texto: "A validar", clase: "text-(--d-tinta2)" },
};

export function Rankings({
  empresa,
  rankings,
  lectura,
}: ConEmpresa & { rankings: Ranking[]; lectura?: string | null }) {
  if (rankings.length === 0) return null;

  return (
    <Lamina
      empresa={empresa}
      kicker="Qué ve Google"
      titulo="Dónde aparecés y dónde no"
      lead="Buscamos en Google Argentina con las palabras que usaría el comprador, no con el nombre de tu empresa."
    >
      <Tabla
        columnas={["Lo que escribe el comprador", empresa, "Quién se queda con ese lugar"]}
        filas={rankings.map((ranking, i) => ({
          clave: `${ranking.keyword}-${i}`,
          celdas: [
            <span key="k" className="text-navy">{ranking.keyword}</span>,
            <span key="a" className={`font-semibold ${APARECE[ranking.aparece].clase}`}>
              {APARECE[ranking.aparece].texto}
              {ranking.posicion && (
                <span className="block font-normal text-(--d-tinta2)">{ranking.posicion}</span>
              )}
            </span>,
            ranking.ocupan.length > 0 ? (
              <span key="o">{ranking.ocupan.join(" · ")}</span>
            ) : (
              <AValidar key="o" />
            ),
          ],
        }))}
      />
      {lectura && <Banda>{lectura}</Banda>}
    </Lamina>
  );
}

/* ---------------------------------------------------------------- */
/* Lo que se ve de la marca: ficha de Google y redes                 */
/* ---------------------------------------------------------------- */

export function MarcaPublica({
  empresa,
  ficha,
  redes,
}: ConEmpresa & { ficha: FichaGoogle | null; redes: RedSocial[] }) {
  if (!ficha && redes.length === 0) return null;

  const fichaPendiente = !ficha || ficha.estado === "a_validar";

  return (
    <Lamina
      empresa={empresa}
      kicker="Lo que se ve de la marca"
      titulo="Lo que encuentra alguien que te busca por el nombre"
      lead="La ficha de Google y las redes son, muchas veces, lo primero que ve alguien que ya escuchó de tu empresa."
    >
      <div className="grid grid-cols-1 gap-[clamp(14px,1.6vw,20px)] sm:grid-cols-2 lg:grid-cols-3">
        <Tarjeta>
          <h3 className="disp mb-2 text-[clamp(.9rem,1vw,.98rem)] font-semibold text-navy">
            Ficha de Google
          </h3>
          {fichaPendiente ? (
            <p className="text-[clamp(.86rem,.94vw,.92rem)] leading-[1.5]">
              <AValidar>{ficha?.detalle ?? "Se analiza en el diagnóstico completo."}</AValidar>
            </p>
          ) : (
            <>
              <p className="disp text-[clamp(1.4rem,2.4vw,2rem)] leading-[1.05] font-bold text-magenta">
                {ficha.rating ?? ficha.resenas ?? "Ficha activa"}
              </p>
              <p className="mt-2 text-[clamp(.86rem,.94vw,.92rem)] leading-[1.5] text-(--d-tinta)">
                {[ficha.resenas && ficha.rating ? `${ficha.resenas} reseñas` : null, ficha.categoria]
                  .filter(Boolean)
                  .join(" · ") || ficha.detalle}
              </p>
              {ficha.categoria && (
                <p className="mt-2 text-[clamp(.84rem,.9vw,.9rem)] leading-[1.5] text-(--d-tinta)">
                  {ficha.detalle}
                </p>
              )}
            </>
          )}
        </Tarjeta>

        {redes.map((red, i) => (
          <Tarjeta key={`${red.red}-${i}`}>
            <h3 className="disp mb-2 text-[clamp(.9rem,1vw,.98rem)] font-semibold text-navy">
              {red.red}
            </h3>
            {red.estado === "a_validar" ? (
              <p className="text-[clamp(.86rem,.94vw,.92rem)] leading-[1.5]">
                <AValidar />
              </p>
            ) : (
              <>
                <p className="disp text-[clamp(1.4rem,2.4vw,2rem)] leading-[1.05] font-bold break-words text-magenta">
                  {red.seguidores ?? "Perfil activo"}
                </p>
                {red.actividad && (
                  <p className="mt-2 text-[clamp(.86rem,.94vw,.92rem)] leading-[1.5] text-(--d-tinta)">
                    {red.actividad}
                  </p>
                )}
              </>
            )}
          </Tarjeta>
        ))}
      </div>
    </Lamina>
  );
}

/* ---------------------------------------------------------------- */
/* Mapa del sector                                                   */
/* ---------------------------------------------------------------- */

export function MapaSector({
  empresa,
  competidores,
  pautaPropia,
  busquedasPropias,
  redesPropias,
  fichaPropia,
}: ConEmpresa & {
  competidores: Competidor[];
  pautaPropia: string | null;
  /** Cómo le fue a la empresa en las búsquedas del comprador, en una línea. */
  busquedasPropias: string | null;
  redesPropias: string | null;
  fichaPropia: string | null;
}) {
  if (competidores.length === 0) return null;

  const filaPropia = {
    clave: "propia",
    destacada: true,
    celdas: [
      <span key="n" className="font-bold text-navy">{empresa}</span>,
      busquedasPropias ? <span key="b">{busquedasPropias}</span> : <AValidar key="b" />,
      pautaPropia ? <span key="p">{pautaPropia}</span> : <AValidar key="p" />,
      redesPropias ? <span key="r">{redesPropias}</span> : <AValidar key="r" />,
      fichaPropia ? <span key="f">{fichaPropia}</span> : <AValidar key="f" />,
    ],
  };

  const filas = [
    filaPropia,
    ...competidores.map((competidor, i) => ({
      clave: `${competidor.nombre}-${i}`,
      destacada: false,
      celdas: [
        <span key="n" className="text-navy">
          <b className="font-semibold">{competidor.nombre}</b>
          <span className="mt-1 block text-[.78rem] leading-[1.35] text-(--d-tinta2)">
            {competidor.por_que_compite}
          </span>
        </span>,
        <Hallazgo key="b" texto={competidor.busquedas?.detalle} estado={competidor.busquedas?.estado} />,
        <Hallazgo key="p" texto={competidor.pauta?.detalle} estado={competidor.pauta?.estado} />,
        <Hallazgo key="r" texto={competidor.redes?.detalle} estado={competidor.redes?.estado} />,
        <Hallazgo key="f" texto={competidor.ficha_google?.detalle} estado={competidor.ficha_google?.estado} />,
      ],
    })),
  ];

  return (
    <Lamina
      empresa={empresa}
      kicker="La competencia"
      titulo="Dónde está la vara del mercado"
      lead="Competidores verificados uno por uno: mismo rubro, misma zona, el mismo que compra. De cada uno miramos solo lo que es público."
    >
      <Tabla
        columnas={["Empresa", "En las búsquedas", "Anuncios", "Redes", "Ficha de Google"]}
        filas={filas}
      />
    </Lamina>
  );
}

function Hallazgo({ texto, estado }: { texto?: string | null; estado?: string }) {
  if (!texto || estado === "a_validar") return <AValidar />;
  return <span>{texto}</span>;
}

/* ---------------------------------------------------------------- */
/* Tabla del deck: filas en desktop, tarjetas en celular            */
/* ---------------------------------------------------------------- */

type Fila = { clave: string; destacada?: boolean; celdas: React.ReactNode[] };

function Tabla({ columnas, filas }: { columnas: string[]; filas: Fila[] }) {
  return (
    <>
      {/* Desktop: la tabla del deck, con el encabezado navy. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[clamp(.78rem,.9vw,.9rem)]">
          <thead>
            <tr>
              {columnas.map((columna, i) => (
                <th
                  key={columna}
                  scope="col"
                  className={`bg-navy p-[clamp(10px,1.2vw,15px)] text-left font-sans text-[clamp(.7rem,.82vw,.82rem)] font-semibold text-white ${
                    i === 0 ? "rounded-tl-lg" : ""
                  } ${i === columnas.length - 1 ? "rounded-tr-lg" : ""}`}
                >
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.clave} className={fila.destacada ? "bg-magenta/[.06]" : "even:bg-[#fafafb]"}>
                {fila.celdas.map((celda, i) => (
                  <td
                    key={i}
                    className="border-b border-(--d-linea) p-[clamp(10px,1.2vw,15px)] align-top leading-[1.4] text-(--d-tinta)"
                  >
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: una tarjeta por fila. Una tabla de 5 columnas en 360px no
          se lee, y el scroll horizontal esconde justo la comparación. */}
      <div className="flex flex-col gap-[clamp(12px,1.4vw,18px)] md:hidden">
        {filas.map((fila) => (
          <div
            key={fila.clave}
            className={`rounded-[14px] p-[clamp(16px,1.9vw,24px)] ${
              fila.destacada ? "bg-magenta/[.06]" : "bg-(--d-cardbg)"
            }`}
          >
            <div className="text-[.96rem] leading-[1.3]">{fila.celdas[0]}</div>
            <dl className="mt-3 flex flex-col gap-2">
              {columnas.slice(1).map((columna, i) => (
                <div key={columna} className="grid grid-cols-[minmax(0,9ch)_minmax(0,1fr)] gap-3">
                  <dt className="text-[.72rem] leading-[1.35] font-bold tracking-[.06em] text-navy uppercase">
                    {columna}
                  </dt>
                  <dd className="text-[.84rem] leading-[1.4] text-(--d-tinta)">
                    {fila.celdas[i + 1]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
