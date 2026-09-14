import type { Metadata } from "next";

import { analysisMode } from "@/lib/analysis/analyze";
import { modeloDeAnalisis } from "@/lib/analysis/modelo";
import { createServerSupabase } from "@/lib/supabase/server";
import { CabeceraPagina, Panel } from "../_components/ui";
import { SelectorModelo } from "./SelectorModelo";

export const metadata: Metadata = {
  title: "Configuración — Consola Qualita",
  robots: { index: false, follow: false },
};

export default async function ConfiguracionPage() {
  const supabase = await createServerSupabase();
  const { modelo, origen } = await modeloDeAnalisis(supabase);
  const mock = analysisMode() === "mock";

  return (
    <>
      <CabeceraPagina titulo="Configuración" desc="Cuenta, equipo y parámetros del método." />

      <div className="max-w-3xl">
        <Panel
          titulo="Modelo de análisis"
          desc="El modelo de Claude que interpreta los hechos del sitio. Aplica a las auditorías que arranquen después de guardar."
        >
          {mock ? (
            <p className="mb-4 rounded-campo border border-warn/25 bg-warnbg px-3 py-2 text-[0.8rem] font-medium text-warn">
              ANALYSIS_MODE está en mock: los análisis no llaman a Claude y este ajuste no tiene
              efecto hasta pasarlo a live.
            </p>
          ) : null}

          {origen === "entorno" ? (
            <p className="mb-4 text-[0.8rem] text-tinta">
              Hoy se usa <span className="font-semibold text-navy">{modelo}</span>, tomado de
              ANTHROPIC_MODEL. Al guardar un modelo acá, pasa a mandar este.
            </p>
          ) : null}

          <SelectorModelo actual={origen === "consola" ? modelo : null} />
        </Panel>
      </div>
    </>
  );
}
