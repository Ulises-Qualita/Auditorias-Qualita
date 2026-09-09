import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  esInformeVisible,
  mesYAnio,
  parseResults,
  type DiagnosticResults,
} from "@/lib/diagnostico/results";
import { PantallaAnalizando } from "../../_components/PantallaAnalizando";
import { PantallaSinInforme } from "../../_components/PantallaSinInforme";
import { AValidar, CtaQualita, Fugas, PieInforme } from "./CierreInforme";
import { HeroInforme } from "./HeroInforme";
import { Pilares } from "./Pilares";

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
    return <PantallaAnalizando />;
  }

  if (!esInformeVisible(informe.status)) {
    return <PantallaSinInforme />;
  }

  // Un results corrupto o de una versión vieja del método degrada a la
  // pantalla sobria; nunca a medio informe ni a un 500.
  const results = parseResults(informe.results);
  if (!results) return <PantallaSinInforme />;

  return <Informe informe={informe} results={results} />;
}

function Informe({ informe, results }: { informe: Informe; results: DiagnosticResults }) {
  const fecha = mesYAnio(informe.created_at);

  return (
    <>
      {results.analysis_source === "mock" && <BannerMock />}

      <HeroInforme
        empresa={informe.company.name}
        rubro={informe.company.industry}
        provincia={informe.company.province}
        fecha={fecha}
        resumen={results.resumen}
        scoreGeneral={informe.score_general}
        scoreInfra={informe.score_infra}
        scoreMarca={informe.score_marca}
        preliminar={informe.status === "preliminary"}
      />

      <Pilares infra={results.infra} scoreInfra={informe.score_infra} />
      <Fugas fugas={results.fugas} />
      <AValidar items={results.a_validar} />
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

