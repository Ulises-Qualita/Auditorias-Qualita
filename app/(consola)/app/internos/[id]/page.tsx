import type { Metadata } from "next";

import { DetalleDiagnostico } from "../../_components/DetalleDiagnostico";

/** Detalle de un diagnóstico interno. Mismo contenido que el de un lead
 *  (_components/DetalleDiagnostico), sin el estado de lead. */

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Diagnóstico interno — Consola Qualita",
  robots: { index: false, follow: false },
};

export default async function DetalleInternoPage({ params }: PageProps<"/app/internos/[id]">) {
  const { id } = await params;
  return <DetalleDiagnostico id={id} vista="interno" />;
}
