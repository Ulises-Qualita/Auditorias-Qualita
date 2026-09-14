import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  esInformeVisible,
  fechaLarga,
  mesYAnio,
  parseResults,
  type DiagnosticResults,
} from "@/lib/diagnostico/results";
import { PantallaAnalizando } from "../../_components/PantallaAnalizando";
import { PantallaSinInforme } from "../../_components/PantallaSinInforme";
import { extraerHechos, type HechosInforme } from "@/lib/diagnostico/hechos";
import { CtaQualita, PieInforme } from "./CierreInforme";
import { HeroInforme } from "./HeroInforme";
import { Mazo } from "./Deck";
import { EnNumeros, MatrizContacto, Medicion } from "./HechosDeck";
import { Velocidad } from "./VelocidadDeck";
import {
  Fugas,
  LaminaCanal,
  LoQueYaTienen,
  PorDondeMiramos,
  Recorrido,
  ResumenCanales,
  SeisPasos,
} from "./SeccionesDeck";

/** Informe público, resuelto por `share_tokens.token` y no por id: el id no
 *  se comparte nunca. Todo lo que se muestra sale de `results` y de la
 *  empresa; nada hardcodeado.
 *
 *  RLS está activo sin policies, así que la lectura pasa por el admin client.
 *  Eso obliga a que esto sea server-only: la secret key no toca el browser. */

export const runtime = "nodejs";

type Informe = {
  status: string;
  score_general: number | null;
  score_infra: number | null;
  score_marca: number | null;
  created_at: string;
  results: unknown;
  company: { name: string; industry: string | null; province: string | null };
};

async function cargarInforme(token: string): Promise<Informe | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("share_tokens")
    .select(
      "diagnostics(status, score_general, score_infra, score_marca, created_at, results, companies(name, industry, province))",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  // Los joins vienen como objeto o array según cómo infiera el cliente.
  const diagnostico = unoSolo(data.diagnostics);
  if (!diagnostico) return null;

  const company = unoSolo(diagnostico.companies);
  if (!company) return null;

  return {
    status: diagnostico.status,
    score_general: diagnostico.score_general,
    score_infra: diagnostico.score_infra,
    score_marca: diagnostico.score_marca,
    created_at: diagnostico.created_at,
    results: diagnostico.results,
    company,
  };
}

function unoSolo<T>(valor: T | T[] | null): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export async function generateMetadata({
  params,
}: PageProps<"/d/[token]">): Promise<Metadata> {
  const { token } = await params;
  const informe = await cargarInforme(token);

  return {
    title: informe
      ? `Diagnóstico digital de ${informe.company.name} — Qualita Studio`
      : "Diagnóstico digital — Qualita Studio",
    // La URL es un link privado que se comparte: que Google la indexe sería
    // publicar el diagnóstico de un cliente.
    robots: { index: false, follow: false },
  };
}

export default async function InformePage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;
  const informe = await cargarInforme(token);

  if (!informe) notFound();

  if (informe.status === "pending" || informe.status === "analyzing") {
    return <PantallaAnalizando status={informe.status} />;
  }

  if (!esInformeVisible(informe.status)) {
    return <PantallaSinInforme />;
  }

  // Un results corrupto o de una versión vieja del método degrada a la
  // pantalla sobria; nunca a medio informe ni a un 500.
  const results = parseResults(informe.results);
  if (!results) return <PantallaSinInforme />;

  // Proyección chica de los facts (estados y conteos, nada crudo). null en
  // informes sin facts: las láminas que dependen de ellos caen a la versión
  // que sale solo de `results`.
  const hechos = extraerHechos(informe.results);

  return <Informe informe={informe} results={results} hechos={hechos} />;
}

function Informe({
  informe,
  results,
  hechos,
}: {
  informe: Informe;
  results: DiagnosticResults;
  hechos: HechosInforme | null;
}) {
  const fecha = mesYAnio(informe.created_at);
  const empresa = informe.company.name;
  const { canales } = results;

  return (
    <>
      {results.analysis_source === "mock" && <BannerMock />}

      {/* Las láminas del deck de referencia (docs/referencia-diseno-informe.html),
          empezando por la portada con el puntaje, con los datos de ESTE
          diagnóstico. Las secciones que necesitan búsqueda web (posiciones en
          Google, respuestas con IA, fichas y reseñas, competencia) no están:
          esta versión no las promete. Lo que quedó a validar tampoco va al
          cliente: lo ve el equipo en la consola. */}
      <Mazo>
        <HeroInforme
          empresa={empresa}
          rubro={informe.company.industry}
          provincia={informe.company.province}
          fecha={fechaLarga(informe.created_at)}
          tesis={results.tesis}
          scoreGeneral={informe.score_general}
          preliminar={informe.status === "preliminary"}
        />
        <PorDondeMiramos empresa={empresa} />
        <LoQueYaTienen empresa={empresa} activos={results.activos} />
        <Recorrido
          empresa={empresa}
          pasos={results.recorrido}
          // El tono de alerta de la última tarjeta se decide con el canal de
          // contacto, no leyendo el texto del paso: si no hay por dónde dejar
          // el dato, el recorrido termina mal. Con el canal sano, no se pinta
          // de rojo un final que no lo es.
          desenlaceCritico={
            canales.contacto.madurez <= 2 ||
            canales.contacto.estado === "ausente" ||
            canales.contacto.estado === "fallas_criticas"
          }
        />
        {hechos?.contacto ? (
          <MatrizContacto
            empresa={empresa}
            contacto={hechos.contacto}
            insight={canales.contacto.insight}
          />
        ) : (
          <LaminaCanal
            empresa={empresa}
            kicker="Vías de contacto"
            titulo="Cómo se deja un dato en tu sitio"
            canal={canales.contacto}
          />
        )}
        <LaminaCanal
          empresa={empresa}
          kicker="El sitio"
          titulo="Lo que encontramos en el sitio"
          canal={canales.sitio}
        />
        {hechos?.velocidad && <Velocidad empresa={empresa} velocidad={hechos.velocidad} />}
        <LaminaCanal
          tono="dark"
          empresa={empresa}
          kicker="Arquitectura"
          titulo="Cómo está ordenado el sitio"
          canal={canales.orden}
        />
        <LaminaCanal
          empresa={empresa}
          kicker="Qué ve Google"
          titulo="Lo que Google lee de tu sitio"
          canal={canales.busqueda}
        />
        {hechos ? (
          <>
            <EnNumeros empresa={empresa} hechos={hechos} titular={results.cierre.titular} />
            <Medicion empresa={empresa} hechos={hechos} insight={canales.medicion.insight} />
          </>
        ) : (
          <LaminaCanal
            empresa={empresa}
            kicker="Medición"
            titulo="Las piezas para saber de dónde vino cada consulta"
            canal={canales.medicion}
          />
        )}
        <Fugas empresa={empresa} fugas={results.fugas} />
        <ResumenCanales empresa={empresa} canales={canales} />
        <SeisPasos empresa={empresa} plan={results.plan} />
      </Mazo>

      <CtaQualita cantidadFugas={results.fugas.length} />

      <PieInforme fecha={fecha} />
    </>
  );
}

/** Un informe generado con datos mock no puede pasar por real ni de lejos. */
function BannerMock() {
  return (
    <div className="bg-navy px-[clamp(18px,5vw,32px)] py-2.5 text-center text-[0.78rem] font-semibold tracking-[0.04em] text-white/85">
      Vista de prueba · datos mock, no es un diagnóstico real
    </div>
  );
}

