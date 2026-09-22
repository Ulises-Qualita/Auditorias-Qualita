import { Fragment } from "react";

import { canalesPuntuados, type CanalPuntuado } from "@/lib/analysis/score";
import {
  fechaLarga,
  mesYAnio,
  type DiagnosticResults,
  type LecturaInforme,
} from "@/lib/diagnostico/results";
import type { HechosInforme } from "@/lib/diagnostico/hechos";
import {
  Alcance,
  Captacion,
  Cierre,
  columnaCompetidor,
  columnaPropia,
  Estructura,
  GoogleAds,
  Home,
  Mazo,
  Medicion,
  MetaAds,
  Metodo,
  Modelo,
  NotaMetodo,
  Organico,
  Portada,
  Pregunta,
  PuntoDePartida,
  RedesFicha,
  ScorePorCanal,
  Sector,
  Sintesis,
  Titulos,
} from "./Laminas";

/** El informe entero: la portada, las láminas que tienen con qué dibujarse y
 *  el cierre, en el orden de docs/auditoria-ejemplo.html. Recibe todo ya
 *  cargado; la lectura de la base vive en page.tsx. */

/** Lo que page.tsx lee de la base para dibujar el informe. */
export type InformeCargado = {
  status: string;
  score_general: number | null;
  score_infra: number | null;
  score_marca: number | null;
  created_at: string;
  results: unknown;
  company: { name: string; industry: string | null; province: string | null };
};

export function Informe({
  informe,
  results,
  hechos,
}: {
  informe: InformeCargado;
  results: DiagnosticResults;
  hechos: HechosInforme | null;
}) {
  const empresa = informe.company.name;
  const fecha = fechaLarga(informe.created_at);
  const competidores = results.mapa_sector ?? [];
  const lecturas = results.lecturas;

  // Cada lámina se dibuja solo si su bloque existe: un informe viejo, uno sin
  // búsqueda o uno donde el modelo no tuvo evidencia para un bloque opcional
  // simplemente tiene menos láminas. Nunca una lámina con relleno. La
  // numeración se hace después de filtrar, así el pie no saltea números.
  const laminas: Array<[string, (pg: number) => React.ReactNode] | null> = [
    ["alcance", (pg) => <Alcance empresa={empresa} pg={pg} conclusion={results.conclusiones?.alcance ?? null} />],
    activosConNumero(results.activos).length > 0
      ? [
          "partida",
          (pg) => (
            <PuntoDePartida
              empresa={empresa}
              pg={pg}
              activos={activosConNumero(results.activos)}
              conclusion={results.conclusiones?.punto_de_partida ?? null}
            />
          ),
        ]
      : null,
    results.escena
      ? ["pregunta", (pg) => <Pregunta empresa={empresa} pg={pg} escena={results.escena!} pasos={results.recorrido} />]
      : null,
    results.titulos ? ["titulos", (pg) => <Titulos empresa={empresa} pg={pg} bloque={results.titulos!} />] : null,
    results.home
      ? [
          "home",
          (pg) => (
            <Home
              empresa={empresa}
              pg={pg}
              bloque={results.home!}
              busquedas={(results.seo?.rankings ?? []).map((ranking) => ({
                keyword: ranking.keyword,
                aparece: ranking.aparece,
              }))}
            />
          ),
        ]
      : null,
    results.modelo ? ["modelo", (pg) => <Modelo empresa={empresa} pg={pg} bloque={results.modelo!} />] : null,
    results.captacion ? ["captacion", (pg) => <Captacion empresa={empresa} pg={pg} bloque={results.captacion!} />] : null,
    results.estructura ? ["estructura", (pg) => <Estructura empresa={empresa} pg={pg} bloque={results.estructura!} />] : null,
    results.seo?.titulo && results.seo.rankings.length > 0
      ? ["organico", (pg) => <Organico empresa={empresa} pg={pg} seo={results.seo!} />]
      : null,
    conPauta(results.google_ads)
      ? ["google_ads", (pg) => <GoogleAds empresa={empresa} pg={pg} pauta={results.google_ads!} />]
      : null,
    conPauta(results.meta_ads)
      ? ["meta_ads", (pg) => <MetaAds empresa={empresa} pg={pg} pauta={results.meta_ads!} />]
      : null,
    results.redes_ficha
      ? [
          "redes",
          (pg) => (
            <RedesFicha
              empresa={empresa}
              pg={pg}
              bloque={results.redes_ficha!}
              seguidores={barrasSeguidores(empresa, results)}
              resenas={barrasResenas(empresa, results)}
            />
          ),
        ]
      : null,
    results.medicion_deck && hechos
      ? [
          "medicion",
          (pg) => (
            <Medicion
              empresa={empresa}
              pg={pg}
              bloque={results.medicion_deck!}
              columnas={[
                columnaPropia(empresa, hechos),
                ...competidores.map((c) => columnaCompetidor(c.nombre, lecturaDe(c.sitio, lecturas))),
              ]}
            />
          ),
        ]
      : null,
    results.sector
      ? [
          "sector",
          (pg) => (
            <Sector
              empresa={empresa}
              pg={pg}
              bloque={results.sector!}
              filas={competidores.map((c) => ({ nombre: c.nombre, celdas: c.celdas ?? null }))}
            />
          ),
        ]
      : null,
    [
      "score",
      (pg) => (
        <ScorePorCanal
          empresa={empresa}
          pg={pg}
          canales={canalesDelScore(results)}
          conclusion={results.score_canales?.conclusion ?? null}
        />
      ),
    ],
    [
      "metodo",
      (pg) => (
        <Metodo empresa={empresa} pg={pg} plan={results.plan} conclusion={results.conclusiones?.metodo ?? null} />
      ),
    ],
    results.sintesis ? ["sintesis", (pg) => <Sintesis empresa={empresa} pg={pg} bloque={results.sintesis!} />] : null,
    [
      "nota",
      (pg) => (
        <NotaMetodo
          empresa={empresa}
          pg={pg}
          fecha={fechaCorta(informe.created_at)}
          fuentes={fuentesDelMetodo(results, hechos)}
          aValidar={results.conclusiones?.a_validar ?? null}
          conclusion={results.conclusiones?.nota_metodo ?? null}
        />
      ),
    ],
  ];

  return (
    <Mazo mock={results.analysis_source === "mock"}>
      <Portada
        empresa={empresa}
        tesis={results.tesis}
        competidores={competidores.map((c) => c.nombre)}
        fuente={lineaDeFuentes(fecha, results)}
        score={informe.score_general}
        preliminar={informe.status === "preliminary"}
      />
      {laminas
        .filter((lamina) => lamina !== null)
        .map(([clave, dibujar], i) => (
          // La portada es la 1: las demás arrancan en 2, como en el deck.
          <Fragment key={clave}>{dibujar(i + 2)}</Fragment>
        ))}
      <Cierre empresa={empresa} mesAnio={mesYAnio(informe.created_at)} />
    </Mazo>
  );
}

/* ---------------------------------------------------------------- */
/* Datos derivados para las láminas                                  */
/* ---------------------------------------------------------------- */

/** Las tarjetas del punto de partida que de verdad muestran un número.
 *
 *  La tarjeta es un número grande con su etiqueta: un estado ahí adentro
 *  ("quarantine", "GA4", "Título propio") se lee como error de diseño. El
 *  prompt ya lo pide, pero esto lo garantiza, y también limpia los informes
 *  guardados antes de analysis-2.2.0.
 *
 *  Entra lo que empieza con una cifra, con el signo que la acompaña ("+50",
 *  "#1", "4,9★ · 279", "~2") o con "Top 3". Queda afuera lo que empieza con
 *  una palabra, aunque tenga un número adentro ("GA4", "Quarantine", "Zonas"). */
function activosConNumero(activos: DiagnosticResults["activos"]): DiagnosticResults["activos"] {
  return activos.filter((activo) => /^([+#~<>≈]?\d|top\s*\d)/i.test(activo.dato.trim()));
}

/** Si la lámina de pauta tiene algo para mostrar.
 *
 *  Con el título solo no alcanza: la búsqueda web no puede leer el Centro de
 *  Transparencia de Google ni la Biblioteca de Meta (son aplicaciones con
 *  JavaScript), así que el modelo devolvía el bloque con todo en "a validar" y
 *  la lámina quedaba vacía. Desde analysis-2.2.0 el prompt directamente no lo
 *  devuelve sin evidencia; esto además protege a los informes ya guardados. */
function conPauta(pauta: DiagnosticResults["google_ads"] | DiagnosticResults["meta_ads"]): boolean {
  if (!pauta?.titulo) return false;
  if (pauta.actividad === "activa") return true;
  return (
    (pauta.fuentes?.length ?? 0) > 0 ||
    (pauta.anunciantes?.length ?? 0) > 0 ||
    (pauta.comparativa ?? []).some((fila) => fila.valor != null) ||
    (pauta.destinos?.length ?? 0) > 0
  );
}

function dominioDe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** La lectura de la home de un competidor, buscada por dominio. */
function lecturaDe(sitio: string | null | undefined, lecturas: LecturaInforme[]): LecturaInforme | null {
  const dominio = dominioDe(sitio);
  if (!dominio) return null;
  return (
    lecturas.find(
      (l) => l.para === "competidor" && (dominioDe(l.finalUrl) === dominio || dominioDe(l.dominio) === dominio),
    ) ?? null
  );
}

function barrasSeguidores(empresa: string, results: DiagnosticResults) {
  const propia = (results.redes ?? []).find((red) => /insta/i.test(red.red) && red.estado !== "a_validar");
  return [
    { nombre: empresa, valor: propia?.seguidores ?? null, destacada: true },
    ...(results.mapa_sector ?? []).map((c) => ({ nombre: c.nombre, valor: c.instagram ?? null })),
  ];
}

function barrasResenas(empresa: string, results: DiagnosticResults) {
  const ficha = results.ficha_google?.estado === "a_validar" ? null : results.ficha_google;
  const rotulo = (nombre: string, rating: string | null | undefined) => (rating ? `${nombre} ${rating}★` : nombre);
  return [
    { nombre: rotulo(empresa, ficha?.rating), valor: ficha?.resenas ?? null, destacada: true },
    ...(results.mapa_sector ?? []).map((c) => ({ nombre: rotulo(c.nombre, c.rating), valor: c.resenas ?? null })),
  ];
}

/** Los seis canales, ordenados de mayor a menor madurez como en el deck. Un
 *  informe viejo, sin score_canales, muestra solo los dos que salen de los
 *  facts, con el insight de su canal. */
function canalesDelScore(results: DiagnosticResults): CanalPuntuado[] {
  const canales = canalesPuntuados(results).map((canal) => ({
    ...canal,
    detalle:
      canal.detalle ??
      (canal.clave === "sitio" ? results.canales.sitio.insight : canal.clave === "medicion" ? results.canales.medicion.insight : null),
  }));
  const visibles = results.score_canales ? canales : canales.filter((c) => c.clave === "sitio" || c.clave === "medicion");
  return visibles
    .map((canal, i) => ({ canal, i }))
    .sort((x, y) => (y.canal.madurez ?? 0) - (x.canal.madurez ?? 0) || x.i - y.i)
    .map(({ canal }) => canal);
}

const conBusqueda = (results: DiagnosticResults) => (results.investigacion?.hechas ?? 0) > 0;

/** La línea de fuentes de la portada: dice lo que se usó de verdad. */
function lineaDeFuentes(fecha: string, results: DiagnosticResults): string {
  const fuentes = ["código del sitio", "DNS"];
  if (results.lecturas.some((l) => l.para === "competidor")) fuentes.push("sitios de la competencia");
  if (conBusqueda(results)) {
    fuentes.push("Google Argentina");
    // Solo lo que de verdad se pudo leer: un bloque "a_validar" no es una fuente.
    const leido = (bloque: { estado: string } | null | undefined) => bloque != null && bloque.estado !== "a_validar";
    if (leido(results.google_ads) || leido(results.meta_ads)) fuentes.push("bibliotecas públicas de anuncios");
    if (leido(results.ficha_google)) fuentes.push("fichas de Google");
    if ((results.redes ?? []).length > 0) fuentes.push("redes");
  }
  return `${fecha ? `Relevado el ${fecha} · ` : ""}Fuentes: ${fuentes.join(", ")} · Sin estimaciones: lo que no se pudo verificar va marcado.`;
}

/** La tabla de la nota de método, armada con lo que esta corrida hizo. */
function fuentesDelMetodo(results: DiagnosticResults, hechos: HechosInforme | null): Array<[string, string]> {
  const internas = results.lecturas.filter((l) => l.para === "cliente").length;
  const deCompetencia = results.lecturas.filter((l) => l.para === "competidor").length;
  const hechas = results.investigacion?.hechas ?? 0;

  const filas: Array<[string, string]> = [
    [
      "Sitio web",
      [
        "Código de la home (HTML inicial y contenedor de Tag Manager)",
        internas > 0 ? `${internas} página${internas > 1 ? "s" : ""} interna${internas > 1 ? "s" : ""} leída${internas > 1 ? "s" : ""} con los mismos chequeos` : null,
        hechos?.velocidad ? "velocidad medida con PageSpeed de Google" : null,
      ]
        .filter(Boolean)
        .join("; ") + ".",
    ],
    ["Correo", "Registro DNS del dominio (DMARC)."],
  ];

  if (deCompetencia > 0) {
    filas.push(["Competencia", `Home de ${deCompetencia} competidor${deCompetencia > 1 ? "es" : ""} leída con los mismos chequeos del sitio.`]);
  }
  if (hechas > 0) {
    filas.push([
      "Google y redes",
      `${hechas} búsqueda${hechas > 1 ? "s" : ""} web desde Argentina: posiciones, fichas de Google, perfiles públicos y bibliotecas de anuncios. Cada dato con su fuente.`,
    ]);
  }
  return filas;
}

/** "15/9/2026" para la nota de método. */
function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}
