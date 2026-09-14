import type { Metadata } from "next";

import { BotonSecundario, CabeceraPagina } from "../../_components/ui";
import { FormInterno } from "./FormInterno";

export const metadata: Metadata = {
  title: "Generar diagnóstico — Consola Qualita",
  robots: { index: false, follow: false },
};

export default function NuevoInternoPage() {
  return (
    <div className="max-w-[640px]">
      <div className="mb-5">
        <BotonSecundario href="/app/internos">← Diagnósticos internos</BotonSecundario>
      </div>
      <CabeceraPagina
        titulo="Generar diagnóstico"
        desc="Los datos de la empresa y listo: el análisis corre en segundo plano y te llevamos al detalle para seguirlo."
      />
      <FormInterno />
    </div>
  );
}
