import "server-only";
import Anthropic from "@anthropic-ai/sdk";

import { createAdminClient } from "@/lib/supabase/admin";
import { collect, COLLECT_VERSION, normalizarEntrada, type SiteFacts } from "./collect";
import { pageSpeed, sinMedicion, type PageSpeedFacts } from "./collectors/pageSpeed";
import { acumularUso, usoInicial, type UsoAnalisis } from "./costo";
import { buildMockOutput, MOCK_ANALYSIS_VERSION } from "./mock";
import { modeloDeAnalisis } from "./modelo";
import { SYSTEM_PROMPT, buildUserMessage, type CompanyForAnalysis } from "./prompt";
import { analysisOutput, type AnalysisOutput } from "./schema";
import { computeScores } from "./score";

/** Interpretación de los facts con Claude. Corre en servidor (Node): usa la
 *  secret key de Supabase y la ANTHROPIC_API_KEY, que nunca van al browser. */

/** 1.4.0: rúbrica de madurez por canal con condiciones sobre los facts. Antes
 *  solo se anclaban 1, 3 y 5, y el mismo sitio con facts idénticos salía con
 *  3 o 4 en "sitio" según la corrida (5 puntos de score).
 *  1.5.0: la velocidad en celular (PageSpeed, con CrUX si hay) entra al
 *  informe como check de "sitio" y pone tope 3 si es mala.
 *  1.6.0: PageSpeed tiene lámina propia (4 puntajes + mejoras, armada por
 *  código); el modelo ya no hace el check de velocidad para no repetirla. */
export const ANALYSIS_VERSION = "analysis-1.6.0";

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
export function analysisMode(): AnalysisMode {
  return process.env.ANALYSIS_MODE?.trim().toLowerCase() === "live" ? "live" : "mock";
}

/** El techo de salida tiene que dejar lugar al thinking, que en Sonnet 5 está
 *  activo por defecto y consume del mismo presupuesto. Con 2000 el JSON se
 *  cortaba a la mitad y el parseo fallaba por truncamiento, no por formato.
 *
 *  Subido a 16000 cuando el informe pasó a la estructura de la auditoría: el
 *  JSON creció (tesis, activos, recorrido, 5 canales, plan y cierre) y con
 *  8000 volvía a quedar cerca del corte. */
const MAX_TOKENS = 16000;

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
  /** Medición de PageSpeed hecha antes, en su propio step (`medirVelocidad`).
   *  Sin ella, `collect` mide en el momento (lo usa la ruta de dev). */
  pageSpeed?: PageSpeedFacts;
};

/** PageSpeed por separado, antes del análisis. Tarda ~50 s (hasta 180 s con
 *  el reintento), y en su propio step de Inngest no le quita tiempo a Claude
 *  dentro del maxDuration de la ruta. Además, si el análisis se reintenta,
 *  esta medición queda memorizada y no se vuelve a pagar la espera.
 *
 *  Pasa el diagnóstico a 'analyzing' al empezar: para quien espera, medir la
 *  velocidad ya es parte del análisis.
 *
 *  Nunca tira. `null` = no se pudo leer la empresa; en ese caso `runAnalysis`
 *  va a encontrar el mismo problema y lo reporta con su clasificación. */
export async function medirVelocidad(diagnosticId: string): Promise<PageSpeedFacts | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("diagnostics")
    .select("status, companies(website)")
    .eq("id", diagnosticId)
    .maybeSingle();
  if (error || !data) return null;

  const empresa = Array.isArray(data.companies) ? data.companies[0] : data.companies;
  const url = normalizarEntrada(empresa?.website);
  if (!url) return sinMedicion("Sin sitio web para medir");

  if (data.status === "pending") {
    await supabase
      .from("diagnostics")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", diagnosticId);
  }

  return pageSpeed(url);
}

export async function runAnalysis(
  diagnosticId: string,
  opciones: RunAnalysisOptions = {},
): Promise<RunAnalysisResult> {
  const { marcarFalloTransitorio: persistirFallo = true, pageSpeed: velocidadPrevia } = opciones;
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
        // Todavía no llamamos a la API: no hay nada gastado que registrar.
        null,
        { retriable: false, persistir: persistirFallo },
      );
    }

    const company: CompanyForAnalysis = {
      name: companyRaw.name,
      website: companyRaw.website,
      industry: companyRaw.industry,
      province: companyRaw.province,
    };

    // Si PageSpeed ya se midió en su step, el diagnóstico está en 'analyzing'
    // desde entonces: volver a pisar updated_at haría que la pantalla de
    // espera recalcule el tiempo desde cero y se quede congelada.
    await supabase
      .from("diagnostics")
      .update(
        velocidadPrevia
          ? { status: "analyzing" }
          : { status: "analyzing", updated_at: new Date().toISOString() },
      )
      .eq("id", diagnosticId);

    // 2. Hechos verificables. No tira nunca: trae warnings si algo falló.
    const facts = await collect(company, { pageSpeed: velocidadPrevia });

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
        : await pedirAnalisis(supabase, diagnosticId, company, factsLimpios);

    if (!interpretacion.ok) {
      return await marcarFallido(
        supabase,
        diagnosticId,
        interpretacion.error,
        methodVersion,
        interpretacion.uso,
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
      // Lo único que va acá es lo que NO se pudo verificar en esta corrida.
      // Los canales que esta versión directamente no mira (Google Ads, Meta,
      // redes, ficha, competencia) no son "a validar": no se prometen.
      a_validar: factsLimpios.warnings,
    };

    // 7. Queda en 'preliminary': todavía lo tiene que revisar un humano.
    const { error: errorGuardado } = await guardarConCosto(
      supabase,
      diagnosticId,
      {
        status: "preliminary",
        score_general: scores.score_general,
        score_infra: scores.score_infra,
        score_marca: scores.score_marca,
        results,
        method_version: methodVersion,
        updated_at: new Date().toISOString(),
      },
      interpretacion.uso,
    );

    if (errorGuardado) {
      return await marcarFallido(
        supabase,
        diagnosticId,
        `No se pudo guardar el resultado: ${errorGuardado.message}`,
        methodVersion,
        // El análisis salió bien y se pagó; lo que falló fue la escritura.
        interpretacion.uso,
        { retriable: true, persistir: persistirFallo },
      );
    }

    return { ok: true, diagnosticId, scores };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error desconocido";
    // Un throw que no previmos: lo tratamos como transitorio y que Inngest
    // decida cuántas veces vale la pena volver a intentarlo.
    // Un throw imprevisto puede caer antes o después de la llamada a la API;
    // desde acá no sabemos cuál, así que no afirmamos un costo.
    return await marcarFallido(supabase, diagnosticId, detalle, methodVersion, null, {
      retriable: true,
      persistir: persistirFallo,
    });
  }
}

/** Guarda el diagnóstico incluyendo el costo, y si la base todavía no tiene
 *  las columnas —falta correr docs/costos-analisis.sql— reintenta sin ellas.
 *
 *  El costo es un dato accesorio: que falte la migración no puede ser el
 *  motivo por el que se pierda un análisis que ya se pagó.
 *
 *  Ojo con el código de error, que acá se pagó aprendiéndolo: PostgREST valida
 *  el update contra su schema cache ANTES de mandarlo a Postgres, así que una
 *  columna que no existe vuelve como PGRST204 ("Could not find the column ...
 *  in the schema cache"), no como el 42703 de Postgres. Contemplamos los dos:
 *  el 42703 aparece igual por otras vías. Cualquier otro error se devuelve tal
 *  cual, porque ahí sí pasó algo que hay que mirar. */
async function guardarConCosto(
  supabase: ReturnType<typeof createAdminClient>,
  diagnosticId: string,
  campos: Record<string, unknown>,
  uso: UsoAnalisis | null,
) {
  const conCosto = await supabase
    .from("diagnostics")
    .update({
      ...campos,
      analysis_usage: uso,
      analysis_cost_usd: uso?.costoUsd ?? null,
    })
    .eq("id", diagnosticId);

  const columnaFaltante =
    conCosto.error?.code === "PGRST204" || conCosto.error?.code === "42703";
  if (!conCosto.error || !columnaFaltante) return conCosto;

  console.warn(
    "[analysis] la base todavía no tiene las columnas de costo (correr docs/costos-analisis.sql): guardo el diagnóstico sin el costo",
  );

  return supabase.from("diagnostics").update(campos).eq("id", diagnosticId);
}

/** Una fila en `analysis_costs` (docs/registro-gasto.sql) por cada llamada a
 *  la API. Es la fuente del gasto total de la consola: a diferencia de las
 *  columnas de `diagnostics`, no se pisa en un reintento ni se va con un
 *  borrado.
 *
 *  Nunca corta el análisis: si la tabla no existe todavía o el insert falla,
 *  queda un warning y el diagnóstico sigue (el costo igual se guarda en la
 *  fila del diagnóstico, como antes). */
async function registrarLlamada(
  supabase: ReturnType<typeof createAdminClient>,
  { diagnosticId, empresa, uso }: { diagnosticId: string; empresa: string; uso: UsoAnalisis },
): Promise<void> {
  const { error } = await supabase.from("analysis_costs").insert({
    diagnostic_id: diagnosticId,
    empresa,
    modelo: uso.modelo,
    llamadas: uso.llamadas,
    input_tokens: uso.inputTokens,
    output_tokens: uso.outputTokens,
    cache_read_tokens: uso.cacheReadTokens,
    cache_write_tokens: uso.cacheWriteTokens,
    costo_usd: uso.costoUsd,
  });

  if (error) {
    console.warn(
      `[analysis] no se pudo registrar el gasto de ${diagnosticId} en analysis_costs (¿falta docs/registro-gasto.sql?): ${error.message}`,
    );
  }
}

type Interpretacion =
  | { ok: true; output: AnalysisOutput; uso: UsoAnalisis | null }
  | { ok: false; error: string; uso: UsoAnalisis | null };

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
    return {
      ok: false,
      error: `El análisis mock no cumple el esquema: ${evaluado.error}`,
      uso: null,
    };
  }
  // uso null y no cero: el mock no llamó a la API, no es que salió gratis.
  return { ...evaluado, uso: null };
}

/** Llama a Claude y valida. Si el JSON no cumple el esquema, hace UN reintento
 *  mostrándole su propia salida y el error de validación. */
async function pedirAnalisis(
  supabase: ReturnType<typeof createAdminClient>,
  diagnosticId: string,
  company: CompanyForAnalysis,
  facts: SiteFacts,
): Promise<Interpretacion> {
  // Se lee en cada corrida, no al cargar el módulo: un cambio en
  // Configuración tiene que valer para la próxima auditoría sin reiniciar.
  const { modelo: model } = await modeloDeAnalisis(supabase);
  if (!model) {
    return {
      ok: false,
      error: "No hay modelo configurado: elegí uno en Configuración o seteá ANTHROPIC_MODEL",
      uso: null,
    };
  }

  // Se acumula acá y se devuelve pase lo que pase: un análisis que falló en la
  // validación igual consumió tokens y hay que poder verlo en la consola.
  let uso = usoInicial(model);

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

    uso = acumularUso(uso, respuesta.usage);
    // Al libro de gasto apenas vuelve la llamada: si algo tira después, o el
    // diagnóstico se reintenta o se borra, lo pagado ya quedó registrado.
    await registrarLlamada(supabase, {
      diagnosticId,
      empresa: company.name,
      uso: acumularUso(usoInicial(model), respuesta.usage),
    });

    if (respuesta.stop_reason === "refusal") {
      return { ok: false, error: "El modelo declinó responder el análisis", uso };
    }

    const texto = extraerTexto(respuesta);

    if (respuesta.stop_reason === "max_tokens") {
      return {
        ok: false,
        error: `La respuesta se truncó en max_tokens (${MAX_TOKENS}): el JSON quedó incompleto`,
        uso,
      };
    }

    const evaluado = validar(texto);
    if (evaluado.ok) return { ...evaluado, uso };

    // Último intento agotado: devolvemos el motivo real, no un genérico.
    if (intento === 2) {
      return {
        ok: false,
        error: `La respuesta no cumple el esquema tras el reintento: ${evaluado.error}`,
        uso,
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

  return { ok: false, error: "No se obtuvo un análisis válido", uso };
}

type Validacion =
  | { ok: true; output: AnalysisOutput }
  | { ok: false; error: string };

function validar(texto: string): Validacion {
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
  uso: UsoAnalisis | null,
  { retriable, persistir }: { retriable: boolean; persistir: boolean },
): Promise<RunAnalysisResult> {
  // Un fallo permanente se escribe siempre. Uno transitorio con
  // `persistir: false` deja el diagnóstico en 'analyzing': quien llamó todavía
  // tiene reintentos y no quiere mostrarle al cliente un fallo reparable.
  if (!retriable || persistir) {
    // No hay columna de error: el motivo va al jsonb de results para poder
    // depurarlo desde la consola interna.
    // El costo se guarda aunque haya fallado: los tokens se pagaron igual.
    await guardarConCosto(
      supabase,
      diagnosticId,
      {
        status: "failed",
        results: { error, fallo_en: new Date().toISOString() },
        method_version: methodVersion,
        updated_at: new Date().toISOString(),
      },
      uso,
    );
  }

  return { ok: false, diagnosticId, error, retriable };
}
