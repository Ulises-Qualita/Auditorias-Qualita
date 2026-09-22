import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { esInformeVisible, parseResults } from "@/lib/diagnostico/results";
import { extraerHechos } from "@/lib/diagnostico/hechos";
import { PantallaAnalizando } from "../../_components/PantallaAnalizando";
import { PantallaSinInforme } from "../../_components/PantallaSinInforme";
import { Informe, type InformeCargado } from "./InformeDeck";

/** Informe público, resuelto por `share_tokens.token` y no por id: el id no
 *  se comparte nunca. Todo lo que se muestra sale de `results` y de la
 *  empresa; nada hardcodeado.
 *
 *  RLS está activo sin policies, así que la lectura pasa por el admin client.
 *  Eso obliga a que esto sea server-only: la secret key no toca el browser. */

export const runtime = "nodejs";

async function cargarInforme(token: string): Promise<InformeCargado | null> {
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

