import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

/** Endpoint que Inngest usa para descubrir y ejecutar las funciones.
 *
 *  En local: `npm run dev` + `npm run inngest` (Dev Server). El Dev Server
 *  levanta en http://localhost:8288, encuentra este endpoint solo y desde ahí
 *  se ven los eventos y las corridas. No hace falta ninguna key.
 *
 *  runAnalysis usa node:dns (DMARC) y la secret key de Supabase: nodejs, no
 *  edge. Y como el análisis corre acá dentro, el presupuesto de duración es el
 *  de ESTA ruta, no el del submit. */
export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
