// TEMPORAL: monitoreo de la última corrida. Solo lectura. Borrar al terminar.
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const gql = (query: string, variables: Record<string, unknown>) =>
  fetch("http://localhost:8288/v0/gql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  }).then((r) => r.json());

(async () => {
  const eventos = await fetch("http://localhost:8288/v1/events?limit=5").then((r) => r.json());
  const evento = eventos.data.find((e: { name: string }) => e.name === "diagnostic/requested");
  const id = evento.data.diagnosticId as string;
  console.log("diagnóstico", id, "desde", evento.received_at.slice(11, 19));

  const d = await sb.from("diagnostics").select("status, method_version, results").eq("id", id).maybeSingle();
  const r = d.data?.results as { error?: string; lecturas?: unknown[]; investigacion?: { hechas?: number } } | null;
  console.log("estado:", d.data?.status ?? "(no existe)", r?.error ? `| ERROR: ${r.error}` : "");
  if (r?.investigacion) console.log("búsquedas:", r.investigacion.hechas, "| lecturas:", r.lecturas?.length);

  const { data } = await sb.from("analysis_costs").select("created_at, input_tokens, output_tokens, costo_usd").eq("diagnostic_id", id).order("created_at");
  let total = 0;
  for (const f of data ?? []) {
    total += Number(f.costo_usd);
    console.log(" ", f.created_at.slice(11, 19), `in ${f.input_tokens}`, `out ${f.output_tokens}`, `USD ${Number(f.costo_usd).toFixed(2)}`);
  }
  console.log(`llamadas: ${data?.length ?? 0} | total USD ${total.toFixed(2)}`);

  const runs = await fetch(`http://localhost:8288/v1/events/${evento.id}/runs`).then((x) => x.json());
  const runId = runs.data?.[0]?.run_id;
  const t = await gql(`query($id: String!){ runTrace(runID:$id){ status childrenSpans { name status attempts } } }`, { id: runId });
  const traza = t.data?.runTrace;
  console.log("inngest:", traza?.status);
  console.log(" ", (traza?.childrenSpans ?? []).map((c: { name: string; status: string; attempts: number }) => `${c.name}:${c.status}${c.attempts ? `(x${c.attempts + 1})` : ""}`).join(" · "));
})();
