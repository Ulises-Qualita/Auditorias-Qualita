import type { Metadata } from "next";

import { PollingAnalizando } from "./PollingAnalizando";

export const metadata: Metadata = {
  title: "Analizando tu presencia digital — Qualita Studio",
};

/** Pantalla de espera posterior al submit. El server component solo resuelve
 *  los params; el seguimiento en vivo lo hace `PollingAnalizando`, que es
 *  cliente porque necesita el intervalo y la redirección al informe. */
export default async function AnalizandoPage({
  params,
  searchParams,
}: PageProps<"/analizando/[id]">) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : null;

  return <PollingAnalizando id={id} tokenInicial={token} />;
}
