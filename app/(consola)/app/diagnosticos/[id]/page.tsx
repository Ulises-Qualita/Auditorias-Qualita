import type { Metadata } from "next";

import { DetalleDiagnostico } from "../../_components/DetalleDiagnostico";

/** Detalle de un lead (entró por el form). El contenido vive en
 *  _components/DetalleDiagnostico, compartido con los diagnósticos internos. */

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Detalle — Consola Qualita",
  robots: { index: false, follow: false },
};

export default async function DetalleDiagnosticoPage({
  params,
}: PageProps<"/app/diagnosticos/[id]">) {
  const { id } = await params;
  return <DetalleDiagnostico id={id} vista="lead" />;
}
