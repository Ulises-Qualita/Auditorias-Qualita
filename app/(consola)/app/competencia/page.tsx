import type { Metadata } from "next";

import { CabeceraPagina, Vacio } from "../_components/ui";

export const metadata: Metadata = {
  title: "Competencia — Consola Qualita",
  robots: { index: false, follow: false },
};

export default function CompetenciaPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Competencia"
        desc="Comparación de una empresa contra los referentes de su sector."
      />
      <Vacio>Todavía no está implementado. Se arma sobre el mapa del sector del método.</Vacio>
    </>
  );
}
