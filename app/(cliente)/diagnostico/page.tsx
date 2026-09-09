import type { Metadata } from "next";
import FormDiagnostico from "./FormDiagnostico";

export const metadata: Metadata = {
  title: "Autodiagnóstico digital — Qualita Studio",
  description:
    "Contanos de tu empresa y te devolvemos un diagnóstico de tu presencia digital, hecho sobre información pública verificable.",
};

export default function DiagnosticoPage() {
  return <FormDiagnostico />;
}
