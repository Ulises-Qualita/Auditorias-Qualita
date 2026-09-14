import type { Deteccion, HechosInforme, ViaContacto } from "@/lib/diagnostico/hechos";
import {
  Banda,
  DatoGrande,
  Lamina,
  Punto,
  Tarjeta,
  tamanoDeGrupo,
  type VariantePunto,
} from "./Deck";

/** Las láminas que salen de HECHOS verificados por código (lib/diagnostico/
 *  hechos.ts), no del texto del modelo: la matriz de contacto, los números
 *  protagonistas y las piezas de medición.
 *
 *  La regla que manda en todo este archivo: lo que no vimos en el HTML
 *  inicial NO es "no tiene". Se muestra con el aro punteado y lenguaje de "a
 *  confirmar". La ausencia solo se afirma cuando es un hecho (DMARC: lo
 *  contesta el DNS). */

type ConEmpresa = { empresa: string };

const PUNTO_DETECCION: Record<Deteccion, VariantePunto> = {
  detectado: "magenta",
  no_detectado: "duda",
  no_verificable: "vacio",
};

const VIAS: Array<[ViaContacto, string]> = [
  ["formulario", "Formulario"],
  ["telefono", "Teléfono para tocar"],
  ["mail", "Mail"],
  ["whatsapp", "WhatsApp"],
];

const LECTURA_DETECCION: Record<Deteccion, string> = {
  detectado: "Lo vimos en el código",
  no_detectado: "No aparece en el HTML inicial: a confirmar",
  no_verificable: "No se pudo verificar",
};

/** "El sitio · la matriz": las cuatro vías de contacto de la HOME. El deck
 *  cuenta página por página; nosotros bajamos solo la home, así que es una
 *  fila y el título nunca dice "en todo el sitio". */
export function MatrizContacto({
  empresa,
  contacto,
  insight,
}: ConEmpresa & { contacto: HechosInforme["contacto"]; insight: string }) {
  if (!contacto) return null;

  const n = contacto.viasDetectadas;
  const titulo =
    contacto.estado === "no_verificable"
      ? "No pudimos ver cómo se deja un dato en la home"
      : contacto.estado === "no_detectado"
        ? "En la home no vimos por dónde dejar un dato"
        : n === 4
          ? "En la home están las cuatro formas de dejar un dato"
          : n === 1
            ? "En la home hay una sola forma visible de dejar un dato"
            : `En la home hay ${n} de 4 formas visibles de dejar un dato`;

  const notas = notasContacto(contacto);

  return (
    <Lamina
      empresa={empresa}
      kicker="El sitio"
      titulo={titulo}
      lead="Buscamos en el código de la home las cuatro formas de contactarse. Círculo lleno = lo vimos. Círculo punteado = no aparece en el HTML inicial; puede cargarse con JavaScript, así que queda a confirmar."
    >
      <div className="overflow-x-auto">
        <table className="mx-auto w-full max-w-[860px] min-w-[260px] table-fixed border-collapse">
          <thead>
            <tr>
              <th scope="col" className="w-[22%]">
                <span className="sr-only">Página</span>
              </th>
              {VIAS.map(([via, rotulo]) => (
                <th
                  key={via}
                  scope="col"
                  className="disp px-1 pb-4 text-center align-bottom text-[clamp(.74rem,.9vw,.9rem)] leading-[1.25] font-semibold text-navy"
                >
                  {rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th
                scope="row"
                className="py-3 text-left text-[clamp(.86rem,.98vw,.98rem)] font-normal text-navy"
              >
                Home
              </th>
              {VIAS.map(([via, rotulo]) => {
                const estado = contacto.vias[via];
                return (
                  <td key={via} className="py-3 text-center">
                    <span className="inline-flex justify-center">
                      <Punto variante={PUNTO_DETECCION[estado]} tamano="lg" />
                    </span>
                    <span className="sr-only">
                      {rotulo}: {LECTURA_DETECCION[estado]}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`grid grid-cols-1 gap-[clamp(14px,1.6vw,20px)] ${notas ? "md:grid-cols-2" : ""}`}>
        <NotaGris>{insight}</NotaGris>
        {notas && <NotaGris>{notas}</NotaGris>}
      </div>
    </Lamina>
  );
}

/** Lo que agregan los facts más allá de las cuatro vías. Cada frase dice de
 *  dónde sale ("en el menú de la home") y nunca afirma una ausencia. */
function notasContacto(c: NonNullable<HechosInforme["contacto"]>): string | null {
  const frases: string[] = [];
  if (c.contactoEnMenu === true) {
    frases.push("Hay un link a Contacto en el menú de la home.");
  } else if (c.contactoEnMenu === false && c.estado !== "no_verificable") {
    frases.push(
      "No vimos un link a Contacto en el menú del HTML inicial (el menú puede armarse con JavaScript).",
    );
  }
  if (c.camposFormulario !== null && c.camposFormulario > 0) {
    frases.push(
      c.camposFormulario === 1
        ? "El formulario de la home pide un solo dato."
        : `El formulario de la home pide ${c.camposFormulario} datos.`,
    );
  }
  return frases.length > 0 ? frases.join(" ") : null;
}

function NotaGris({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-(--d-cardbg) p-[clamp(14px,1.6vw,20px)] text-[clamp(.86rem,.92vw,.9rem)] leading-[1.5] text-(--d-tinta)">
      {children}
    </div>
  );
}

type Tile = { dato: string; etiqueta: string; tono: "magenta" | "coral" | "navy" };

/** Los números protagonistas, con valores de los facts. "0 de 4" nunca: si
 *  no vimos ninguna vía o ningún tag, el tile dice "A confirmar". */
function armarTiles(h: HechosInforme): Tile[] {
  const tiles: Tile[] = [];

  const c = h.contacto;
  if (c) {
    if (c.estado === "detectado") {
      tiles.push({
        dato: `${c.viasDetectadas} de 4`,
        etiqueta:
          "Formas de contactarse visibles en la home: formulario, teléfono para tocar, mail y WhatsApp",
        tono: c.viasDetectadas <= 1 ? "coral" : "magenta",
      });
    } else {
      tiles.push({
        dato: "A confirmar",
        etiqueta:
          c.estado === "no_verificable"
            ? "Formas de contactarse: la home se arma con JavaScript y no se pudieron verificar"
            : "Formas de contactarse: ninguna visible en el HTML inicial de la home",
        tono: "navy",
      });
    }
  }

  if (h.seo && h.seo.paginasInternas > 0) {
    const n = h.seo.paginasInternas;
    const cripticas =
      h.seo.urlsCripticas > 0
        ? `; ${h.seo.urlsCripticas} con direcciones que no dicen qué hay adentro`
        : "";
    tiles.push({
      dato: String(n),
      etiqueta: `${n === 1 ? "Página interna enlazada" : "Páginas internas enlazadas"} desde la home${cripticas}`,
      tono: "magenta",
    });
  }

  const m = h.medicion;
  if (m.ga4 !== "no_verificable") {
    tiles.push(
      m.tagsDetectados > 0
        ? {
            dato: String(m.tagsDetectados),
            etiqueta: `${m.tagsDetectados === 1 ? "Etiqueta de medición" : "Etiquetas de medición"} en el código de la home (Analytics, Tag Manager, píxel, Google Ads)`,
            tono: "magenta",
          }
        : {
            dato: "A confirmar",
            etiqueta: "Etiquetas de medición: ninguna visible en el HTML inicial de la home",
            tono: "navy",
          },
    );
  }

  const d = h.dmarc;
  if (d && d.existe === false) {
    tiles.push({
      dato: "Sin DMARC",
      etiqueta: "El dominio no está protegido contra mails que se hacen pasar por la empresa",
      tono: "coral",
    });
  } else if (d && d.existe === true) {
    tiles.push(
      d.politica === "none"
        ? {
            dato: "A medias",
            etiqueta:
              "Protección del correo (DMARC): está publicada, pero solo observa; no frena a quien se hace pasar por la empresa",
            tono: "coral",
          }
        : {
            dato: "Protegido",
            etiqueta: "El correo del dominio tiene protección contra suplantación (DMARC)",
            tono: "magenta",
          },
    );
  }

  return tiles;
}

/** "En números": el cierre del deck con los datos duros. El titular es el de
 *  `results.cierre`; los números NO salen del modelo sino de los facts. */
export function EnNumeros({
  empresa,
  hechos,
  titular,
}: ConEmpresa & { hechos: HechosInforme; titular: string }) {
  const tiles = armarTiles(hechos);
  if (tiles.length === 0) return null;
  const tamano = tamanoDeGrupo(tiles.map((tile) => tile.dato));

  return (
    <Lamina empresa={empresa} kicker="En números" titulo={titular}>
      <div
        className={`grid grid-cols-1 gap-[clamp(14px,1.6vw,20px)] sm:grid-cols-2 ${
          tiles.length >= 3 ? "lg:grid-cols-4" : ""
        }`}
      >
        {tiles.map((tile) => (
          <Tarjeta key={tile.etiqueta}>
            <DatoGrande valor={tile.dato} tamano={tamano} tono={tile.tono} />
            <p className="mt-3 text-[clamp(.84rem,.92vw,.9rem)] leading-[1.45] text-(--d-tinta)">
              {tile.etiqueta}
            </p>
          </Tarjeta>
        ))}
      </div>
    </Lamina>
  );
}

type Pieza = {
  nombre: string;
  punto: VariantePunto;
  detalle: string;
  /** Solo para lo que falta de verdad (hoy, DMARC ausente). */
  critica?: boolean;
  aConfirmar?: boolean;
};

function piezaTag(nombre: string, estado: Deteccion, paraQue: string): Pieza {
  if (estado === "detectado") {
    return { nombre, punto: "magenta", detalle: `Está instalado: lo vimos en el código de la home. ${paraQue}` };
  }
  if (estado === "no_detectado") {
    return {
      nombre,
      punto: "duda",
      aConfirmar: true,
      detalle: `No aparece en el HTML inicial de la home; puede cargarse con JavaScript. ${paraQue}`,
    };
  }
  return { nombre, punto: "vacio", detalle: "No se pudo leer la home para verificarlo." };
}

function piezaDmarc(dmarc: HechosInforme["dmarc"]): Pieza {
  const nombre = "Protección del correo";
  if (!dmarc || dmarc.existe === null) {
    return { nombre, punto: "vacio", detalle: "La consulta al dominio no respondió: queda a validar." };
  }
  if (dmarc.existe === false) {
    return {
      nombre,
      punto: "vacio",
      critica: true,
      detalle:
        "El dominio no publica DMARC: no está protegido contra suplantación y nadie recibe avisos si alguien manda mails haciéndose pasar por la empresa.",
    };
  }
  return dmarc.politica === "none"
    ? {
        nombre,
        punto: "magenta",
        detalle: "DMARC está publicado, pero solo observa: todavía no frena los mails que suplantan a la empresa.",
      }
    : { nombre, punto: "magenta", detalle: "DMARC está publicado y protege al dominio contra la suplantación." };
}

/** "Medición": las piezas para saber de dónde vino una consulta. */
export function Medicion({
  empresa,
  hechos,
  insight,
}: ConEmpresa & { hechos: HechosInforme; insight: string }) {
  const m = hechos.medicion;
  const piezas: Pieza[] = [
    piezaTag("Analítica del sitio", m.ga4, "Sin ella no se sabe cuánta gente entra ni desde dónde."),
    piezaTag("Administrador de etiquetas", m.gtm, "Es lo que permite sumar mediciones sin tocar el sitio."),
    piezaTag("Píxel de Instagram y Facebook", m.metaPixel, "Sin él no se puede volver a alcanzar a quien ya visitó el sitio."),
    piezaTag("Conversiones de Google Ads", m.googleAdsConversion, "Es lo que le dice a Google qué clic terminó en consulta."),
    {
      nombre: "Etiquetas de eventos",
      punto: "duda",
      aConfirmar: true,
      detalle:
        "Si se registra cada formulario enviado o cada clic a WhatsApp no se ve desde afuera: se confirma con un acceso de solo lectura.",
    },
    piezaDmarc(hechos.dmarc),
  ];

  return (
    <Lamina
      empresa={empresa}
      kicker="Medición"
      titulo="Las piezas para saber de dónde vino cada consulta"
      lead={insight}
    >
      <p className="text-[.8rem] text-(--d-tinta2)">
        Punto lleno = lo vimos, en el sitio o dentro de su Tag Manager. Punto punteado = no lo
        vimos, a confirmar.
      </p>
      <ul className="flex flex-col gap-[clamp(14px,1.7vw,22px)]">
        {piezas.map((pieza) => (
          <li
            key={pieza.nombre}
            // Mismo tope de ~72 caracteres que el checklist de SeccionesDeck.
            className="grid grid-cols-1 items-start gap-1.5 md:grid-cols-[clamp(220px,24vw,340px)_minmax(0,72ch)] md:gap-8"
          >
            <div
              className={`disp flex flex-wrap items-center gap-x-3 gap-y-1 text-[clamp(.94rem,1.05vw,1.02rem)] leading-[1.3] font-semibold ${
                pieza.critica ? "text-coral" : "text-navy"
              }`}
            >
              <Punto variante={pieza.punto} />
              {pieza.nombre}
            </div>
            <p className="pl-6 text-[clamp(.86rem,.94vw,.92rem)] leading-[1.5] text-(--d-tinta) md:pl-0">
              {pieza.aConfirmar && (
                <span className="mr-2 inline-block rounded-full bg-midbg px-2 py-0.5 align-[1px] text-[.62rem] font-bold tracking-[.08em] text-mid uppercase">
                  A confirmar
                </span>
              )}
              {pieza.detalle}
            </p>
          </li>
        ))}
      </ul>
      <Banda>Medir va antes que pautar. Encender anuncios sin medición es invertir a ciegas.</Banda>
    </Lamina>
  );
}
