import "server-only";
import Anthropic from "@anthropic-ai/sdk";

import { createAdminClient } from "@/lib/supabase/admin";
import { collect, COLLECT_VERSION, type SiteFacts } from "./collect";
import { buildMockOutput, MOCK_ANALYSIS_VERSION } from "./mock";
import { SYSTEM_PROMPT, buildUserMessage, type CompanyForAnalysis } from "./prompt";
import { analysisOutput, type AnalysisOutput } from "./schema";
import { computeScores } from "./score";

/** Interpretación de los facts con Claude. Corre en servidor (Node): usa la
 *  secret key de Supabase y la ANTHROPIC_API_KEY, que nunca van al browser. */

export const ANALYSIS_VERSION = "analysis-1.0.0";

/** Queda guardado en `diagnostics.method_version`: dice con qué recolección y
 *  con qué prompt se generó este informe. Sin esto, un informe viejo no se
 *  puede interpretar cuando el método cambie. */
export const METHOD_VERSION = `${COLLECT_VERSION}+${ANALYSIS_VERSION}`;

/** Un informe mock NO puede pasar por real: lleva su propia method_version y
 *  queda marcado en `results.analysis_source`. */
export const MOCK_METHOD_VERSION = `${COLLECT_VERSION}+${MOCK_ANALYSIS_VERSION}`;

export type AnalysisMode = "mock" | "live";

/** Default deliberado: `mock`. Sin ANALYSIS_MODE seteada nadie gasta la API
 *  key por accidente; para pegarle a Claude hay que pedirlo explícitamente. */
function analysisMode(): AnalysisMode {
  return process.env.ANALYSIS_MODE?.trim().toLowerCase() === "live" ? "live" : "mock";
}

/** El techo de salida tiene que dejar lugar al thinking, que en Sonnet 5 está
 *  activo por defecto y consume del mismo presupuesto. Con 2000 el JSON se
 *  cortaba a la mitad y el parseo fallaba por truncamiento, no por formato. */
const MAX_TOKENS = 8000;

/** Lazy: construirlo al importar el módulo lo ata al momento en que Next
 *  carga el archivo, antes de que el entorno esté listo. */
let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

export type RunAnalysisResult =
  | { ok: true; diagnosticId: string; scores: ReturnType<typeof computeScores> }
  | { ok: false; diagnosticId: string; error: string; retriable: boolean };

/** `retriable: true` = el fallo puede desaparecer solo (red, API de Anthropic,
 *  PageSpeed, Supabase). `false` = volver a correrlo daría exactamente lo mismo
 *  (el diagnóstico no existe, no tiene empresa, el mock no cumple el esquema).
 *  Lo consume la función de Inngest para decidir si reintenta. */
export type RunAnalysisOptions = {
  /** Si es false, un fallo TRANSITORIO no escribe `status: 'failed'`. Lo usa
   *  Inngest mientras le quedan reintentos: el cliente no tiene por qué ver un
   *  fallo que todavía se puede reparar solo. Un fallo permanente se marca
   *  siempre: nadie lo va a reparar y el diagnóstico no puede quedar colgado
   *  en 'analyzing'. */
  marcarFalloTransitorio?: boolean;
};

export async function runAnalysis(
  diagnosticId: string,
  opciones: RunAnalysisOptions = {},
): Promise<RunAnalysisResult> {
  const { marcarFalloTransitorio: persistirFallo = true } = opciones;
  const supabase = createAdminClient();
  const modo = analysisMode();
  const methodVersion = modo === "mock" ? MOCK_METHOD_VERSION : METHOD_VERSION;

  try {
    // 1. Diagnóstico + empresa, y a 'analyzing' para que el polling lo vea.
    const { data: diagnostico, error: errorCarga } = await supabase
      .from("diagnostics")
      .select("id, company_id, companies(name, website, industry, province)")
      .eq("id", diagnosticId)
      .single();

    if (errorCarga || !diagnostico) {
      // .single() sobre cero filas devuelve error PGRST116, no data null: sin
      // este chequeo un diagnóstico inexistente parecería un fallo pasajero de
      // Supabase y se reintentaría al pedo. Cualquier OTRO error sí puede ser
      // pasajero (red, la base caída) y merece reintento.
      const noExiste = !errorCarga || errorCarga.code === "PGRST116";
      return {
        ok: false,
        diagnosticId,
        error: noExiste
          ? `No se encontró el diagnóstico ${diagnosticId}`
          : `No se pudo leer el diagnóstico ${diagnosticId}: ${errorCarga.message}`,
        retriable: !noExiste,
      };
    }

    // El join viene como objeto o array según cómo infiera el cliente.
    const companyRaw = Array.isArray(diagnostico.companies)
      ? diagnostico.companies[0]
      : diagnostico.companies;

    if (!companyRaw) {
      return await marcarFallido(
        supabase,
        diagnosticId,
        "El diagnóstico no tiene empresa asociada",
        methodVersion,
        { retriable: false, persistir: persistirFallo },
      );
    }

    const company: CompanyForAnalysis = {
      name: companyRaw.name,
      website: companyRaw.website,
      industry: companyRaw.industry,
      province: companyRaw.province,
    };

    await supabase
      .from("diagnostics")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", diagnosticId);

    // 2. Hechos verificables. No tira nunca: trae warnings si algo falló.
    const facts = await collect(company);

    // El HTML crudo pesa hasta 3 MB: no va al prompt (quemaría el contexto)
    // ni a la base. Todo lo que necesitamos ya está destilado en los facts.
    const factsLimpios: SiteFacts = {
      ...facts,
      fetch: { ...facts.fetch, html: null },
    };

    // 3-4. Interpretación + validación, con un reintento de corrección.
    //      En modo mock cambia SOLO de dónde sale el JSON: la validación con
    //      zod y todo lo que sigue es exactamente el mismo camino.
    const interpretacion =
      modo === "mock"
        ? interpretarMock(company, factsLimpios)
        : await pedirAnalisis(company, factsLimpios);

    if (!interpretacion.ok) {
      return await marcarFallido(
        supabase,
        diagnosticId,
        interpretacion.error,
        methodVersion,
        // El mock sale del código: si no cumple el esquema, reintentarlo da lo
        // mismo. Contra Claude, en cambio, el fallo suele ser de la API o una
        // respuesta que no validó, y un reintento tiene chances reales.
        { retriable: modo !== "mock", persistir: persistirFallo },
      );
    }
    const parsed = interpretacion.output;

    // 5. Los scores los calcula el código, no el modelo.
    const scores = computeScores(parsed);

    // 6. Lo que se guarda incluye los hechos y lo que quedó sin verificar.
    const results = {
      ...parsed,
      // Marca de origen: en la consola un informe de prueba tiene que
      // distinguirse de uno real de un vistazo.
      analysis_source: modo === "mock" ? ("mock" as const) : ("claude" as const),
      facts: factsLimpios,
      a_validar: [
        ...factsLimpios.warnings,
        "Marca (branding/redes/reputación): requiere análisis completo",
        "Google Ads y Meta Ads: a validar con accesos",
      ],
      pilar_marca: { estado: "a_validar" as const },
    };

    // 7. Queda en 'preliminary': todavía lo tiene que revisar un humano.
    const { error: errorGuardado } = await supabase
      .from("diagnostics")
      .update({
        status: "preliminary",
        score_general: scores.score_general,
        score_infra: scores.score_infra,
        score_marca: scores.score_marca,
        results,
        method_version: methodVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", diagnosticId);

    if (errorGuardado) {
      return await marcarFallido(
        supabase,
        diagnosticId,
        `No se pudo guardar el resultado: ${errorGuardado.message}`,
        methodVersion,
        { retriable: true, persistir: persistirFallo },
      );
    }

    return { ok: true, diagnosticId, scores };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error desconocido";
    // Un throw que no previmos: lo tratamos como transitorio y que Inngest
    // decida cuántas veces vale la pena volver a intentarlo.
    return await marcarFallido(supabase, diagnosticId, detalle, methodVersion, {
      retriable: true,
      persistir: persistirFallo,
    });
  }
}

type Interpretacion =
  | { ok: true; output: AnalysisOutput }
  | { ok: false; error: string };

/** Camino MOCK: arma el output desde los facts en vez de pedírselo a Claude.
 *  Pasa por el MISMO `validar()` a propósito — serializa y re-parsea para que
 *  el mock recorra el mismo JSON.parse + zod que una respuesta real. Si el
 *  mock se desincroniza del esquema, falla acá igual que fallaría el modelo. */
function interpretarMock(
  company: CompanyForAnalysis,
  facts: SiteFacts,
): Interpretacion {
  const evaluado = validar(JSON.stringify(buildMockOutput(company, facts)));
  if (!evaluado.ok) {
    return { ok: false, error: `El análisis mock no cumple el esquema: ${evaluado.error}` };
  }
  return evaluado;
}

/** Llama a Claude y valida. Si el JSON no cumple el esquema, hace UN reintento
 *  mostrándole su propia salida y el error de validación. */
async function pedirAnalisis(
  company: CompanyForAnalysis,
  facts: SiteFacts,
): Promise<Interpretacion> {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) {
    return { ok: false, error: "ANTHROPIC_MODEL no está configurada" };
  }

  const mensajes: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserMessage(company, facts) },
  ];

  for (let intento = 1; intento <= 2; intento += 1) {
    const respuesta = await getAnthropic().messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: mensajes,
    });

    if (respuesta.stop_reason === "refusal") {
      return { ok: false, error: "El modelo declinó responder el análisis" };
    }

    const texto = extraerTexto(respuesta);

    if (respuesta.stop_reason === "max_tokens") {
      return {
        ok: false,
        error: `La respuesta se truncó en max_tokens (${MAX_TOKENS}): el JSON quedó incompleto`,
      };
    }

    const evaluado = validar(texto);
    if (evaluado.ok) return evaluado;

    // Último intento agotado: devolvemos el motivo real, no un genérico.
    if (intento === 2) {
      return {
        ok: false,
        error: `La respuesta no cumple el esquema tras el reintento: ${evaluado.error}`,
      };
    }

    mensajes.push(
      { role: "assistant", content: texto },
      {
        role: "user",
        content: [
          `Ese JSON no cumple el esquema. Error de validación: ${evaluado.error}`,
          "Corregí el JSON para que cumpla el esquema; solo JSON.",
        ].join("\n"),
      },
    );
  }

  return { ok: false, error: "No se obtuvo un análisis válido" };
}

function validar(texto: string): Interpretacion {
  const limpio = quitarCercas(texto);
  if (!limpio) return { ok: false, error: "la respuesta vino vacía" };

  let crudo: unknown;
  try {
    crudo = JSON.parse(limpio);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "JSON inválido";
    return { ok: false, error: `no es JSON parseable (${detalle})` };
  }

  const validado = analysisOutput.safeParse(crudo);
  if (!validado.success) {
    const problemas = validado.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: problemas };
  }

  return { ok: true, output: validado.data };
}

function extraerTexto(respuesta: Anthropic.Message): string {
  return respuesta.content
    .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("")
    .trim();
}

/** El prompt pide JSON pelado, pero si igual viene envuelto en ```json lo
 *  desenvolvemos en vez de gastar el reintento en eso. */
function quitarCercas(texto: string): string {
  const limpio = texto.trim();
  const cercado = limpio.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return (cercado ? cercado[1] : limpio).trim();
}

async function marcarFallido(
  supabase: ReturnType<typeof createAdminClient>,
  diagnosticId: string,
  error: string,
  methodVersion: string,
  { retriable, persistir }: { retriable: boolean; persistir: boolean },
): Promise<RunAnalysisResult> {
  // Un fallo permanente se escribe siempre. Uno transitorio con
  // `persistir: false` deja el diagnóstico en 'analyzing': quien llamó todavía
  // tiene reintentos y no quiere mostrarle al cliente un fallo reparable.
  if (!retriable || persistir) {
    // No hay columna de error: el motivo va al jsonb de results para poder
    // depurarlo desde la consola interna.
    await supabase
      .from("diagnostics")
      .update({
        status: "failed",
        results: { error, fallo_en: new Date().toISOString() },
        method_version: methodVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", diagnosticId);
  }

  return { ok: false, diagnosticId, error, retriable };
}
