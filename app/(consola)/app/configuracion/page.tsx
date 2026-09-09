import type { Metadata } from "next";

import { CabeceraPagina, Vacio } from "../_components/ui";

export const metadata: Metadata = {
  title: "Configuración — Consola Qualita",
  robots: { index: false, follow: false },
};

export default function ConfiguracionPage() {
  return (
    <>
      <CabeceraPagina titulo="Configuración" desc="Cuenta, equipo y parámetros del método." />
      <Vacio>Todavía no está implementado.</Vacio>
    </>
  );
}
