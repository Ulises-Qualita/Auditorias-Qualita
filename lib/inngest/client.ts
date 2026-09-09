import { eventType, Inngest } from "inngest";
import { z } from "zod";

export const inngest = new Inngest({
  id: "qualita-diagnostico",
  // Sin esto el SDK arranca en modo cloud y pide INNGEST_SIGNING_KEY, así que
  // /api/inngest devuelve 500 en local. Atado a NODE_ENV para no depender de
  // que cada uno se acuerde de exportar INNGEST_DEV=1.
  isDev: process.env.NODE_ENV !== "production",
});

/** El evento que dispara el análisis. Definirlo con schema hace dos cosas:
 *  tipa el `event.data` de la función y valida el payload al enviarlo, así un
 *  typo no llega hasta el worker como `undefined`. */
export const diagnosticRequested = eventType("diagnostic/requested", {
  schema: z.object({ diagnosticId: z.uuid() }),
});
