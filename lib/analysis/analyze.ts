import "server-only";
import Anthropic from "@anthropic-ai/sdk";

import { sanitizarCompetidores } from "@/lib/diagnostico/validacion";
import { createAdminClient } from "@/lib/supabase/admin";
import { collect, COLLECT_VERSION, normalizarEntrada, type SiteFacts } from "./collect";
import { pageSpeed, sinMedicion, type PageSpeedFacts } from "./collectors/pageSpeed";
import { acumularUso, permisoGasto, topeUsdAuditoria, usoInicial, type UsoAnalisis } from "./costo";
import { buildMockOutput, MOCK_ANALYSIS_VERSION } from "./mock";
import { modeloDeAnalisis } from "./modelo";
import { buildSystemPrompt, buildUserMessage, type CompanyForAnalysis } from "./prompt";
import { analysisOutput, type AnalysisOutput } from "./schema";
import { computeScores } from "./score";
import {
  ejecutarLecturas,
  herramientaLectura,
  LECTURAS_VERSION,
  MAX_LECTURAS,
  registroInicial,
  type LecturaPagina,
} from "./lecturas";
import {
  armarInvestigacion,
  conBusquedasRestantes,
  extraerBusquedas,
  herramientaBusqueda,
  topeBusquedas,
  ubicacionDeBusqueda,
  WEBSEARCH_VERSION,
  type Investigacion,
} from "./websearch";

/** Interpretación de los facts con Claude. Corre en servidor (Node): usa la
 *  secret key de Supabase y la ANTHROPIC_API_KEY, que nunca van al browser. */

/** 1.4.0: rúbrica de madurez por canal con condiciones sobre los facts. Antes
 *  solo se anclaban 1, 3 y 5, y el mismo sitio con facts idénticos salía con
 *  3 o 4 en "sitio" según la corrida (5 puntos de score).
 *  1.5.0: la velocidad en celular (PageSpeed, con CrUX si hay) entra al
 *  informe como check de "sitio" y pone tope 3 si es mala.
 *  1.6.0: PageSpeed tiene lámina propia (4 puntajes + mejoras, armada por
 *  código); el modelo ya no hace el check de velocidad para no repetirla.
 *  1.7.0: el form pide localidad en vez de provincia, así que el dato de zona
 *  que entra al prompt pasó de "Buenos Aires" a "Bahía Blanca, Buenos Aires"
 *  (misma columna `province`, distinto grano). Cambia qué tan local puede ser
 *  la lectura del sector.
 *  1.8.0: búsqueda web. En modo live el modelo investiga fuentes externas
 *  (posiciones en Google Argentina, competencia, ficha de Google, redes y
 *  pauta) y las devuelve en bloques aparte, con la URL que respalda cada
 *  dato. Los cinco canales del sitio y el score no cambian: se siguen
 *  calculando solo con los facts.
 *  2.0.0: el informe pasa a la estructura de docs/auditoria-ejemplo.html (20
 *  láminas, cada una con su título y su conclusión) y el score a los seis
 *  canales del ejemplo: Sitio web y Medición con la rúbrica de los facts,
 *  Google orgánico, Redes + ficha, Google Ads y Meta Ads con lo que devolvió
 *  la búsqueda. Suma la herramienta `leer_pagina` (lecturas.ts): el código
 *  lee la home de cada competidor y páginas internas del cliente.
 *  2.1.0: cambia la cuenta del score (score.ts): Sitio web pesa 45% en vez
 *  de 30%, y la escala va de 30 a 100 en vez de 20 a 100. Mismo prompt y
 *  mismas madureces, así que un 2.0.0 y un 2.1.0 con los mismos canales dan
 *  puntajes distintos.
 *  2.1.1: el prompt le pide no usar la ejecución de código de la búsqueda para
 *  medir textos ni lanzar búsquedas. En una corrida de producción la usó 10
 *  veces en la llamada final (11 minutos) y se pasó del tope de búsquedas
 *  (31 con max_uses en 3). Hipótesis, no confirmada: las búsquedas lanzadas
 *  desde el código no cuentan para max_uses. */
export const ANALYSIS_VERSION = "analysis-2.1.1";

/** Queda guardado en `diagnostics.method_version`: dice con qué recolección y
 *  con qué prompt se generó este informe. Sin esto, un informe viejo no se
 *  puede interpretar cuando el método cambie. */
export const METHOD_VERSION = `${COLLECT_VERSION}+${ANALYSIS_VERSION}`;

/** Con búsqueda web el método es otro: el informe se apoya en fuentes que no
 *  son el sitio. La versión lo dice, para que dentro de un año se sepa si un
 *  informe viejo miró afuera o no. */
export function methodVersionLive(conBusqueda: boolean): string {
  // Las lecturas van siempre en modo live: su versión también es parte del método.
  const base = `${METHOD_VERSION}+${LECTURAS_VERSION}`;
  return conBusqueda ? `${base}+${WEBSEARCH_VERSION}` : base;
}

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
 *  8000 volvía a quedar cerca del corte.
 *
 *  32000 desde analysis-2.0.0: cada una de las 20 láminas trae su título y su
 *  conclusión, y el JSON casi duplicó su largo.
 *
 *  64000 después de la primera corrida con Sonnet 5: corre con thinking
 *  adaptativo por defecto (esfuerzo "high"), el razonamiento sale de este
 *  mismo presupuesto, y una vuelta gastó los 32000 pensando antes de escribir
 *  una línea del JSON (~14000). Sonnet 5 y Opus 4.8 admiten hasta 128K; solo
 *  se paga lo que se usa. Si hace falta bajar el gasto, la palanca es
 *  `output_config.effort`, no este tope: un tope bajo corta el JSON y se
 *  pierde la corrida. */
export const MAX_TOKENS = 64000;

/** Cuántas veces se reanuda un turno pausado. Con herramientas de servidor la
 *  API corre su propio bucle y, al llegar a su límite de iteraciones, devuelve
 *  `pause_turn`: hay que volver a llamar con el turno tal como quedó para que
 *  siga. El tope evita que un turno que no cierra nunca se reanude para
 *  siempre; cada reanudación reenvía la conversación y se paga. */
export const MAX_PAUSAS = 6;

/** Cuántas vueltas de `leer_pagina` se contestan en un turno. Cada vuelta
 *  puede traer varias lecturas en paralelo; el tope real de lecturas lo pone
 *  MAX_LECTURAS. Esto solo evita un bucle que no cierra. */
export const MAX_VUELTAS_LECTURA = MAX_LECTURAS + 4;

/** Cuántas veces se valida la respuesta en una misma corrida: la primera y
 *  hasta 3 correcciones. Una corrección reusa todo lo buscado (~USD 0,7);
 *  que falle el step, en cambio, hace que Inngest arranque de cero y vuelva a
 *  pagar las búsquedas (~USD 4-5). */
export const INTENTOS_VALIDACION = 4;

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

/** Lo que queda listo antes de interpretar: la empresa, sus facts y con qué
 *  método se va a correr. Es JSON puro a propósito: la función de Inngest lo
 *  guarda como salida de un step (ver lib/inngest/analisisPorPasos.ts). */
export type Preparacion = {
  diagnosticId: string;
  modo: AnalysisMode;
  /** Tope de búsquedas de esta corrida. 0 en mock. */
  tope: number;
  methodVersion: string;
  company: CompanyForAnalysis;
  facts: SiteFacts;
};

/** 1-2 del análisis: carga el diagnóstico y su empresa, lo pasa a
 *  'analyzing' y junta los facts. Nunca tira: un fallo vuelve como
 *  `{ ok: false }` con su clasificación, y ya marcado si correspondía. */
export async function prepararAnalisis(
  diagnosticId: string,
  opciones: RunAnalysisOptions = {},
): Promise<({ ok: true } & Preparacion) | Extract<RunAnalysisResult, { ok: false }>> {
  const { marcarFalloTransitorio: persistirFallo = true, pageSpeed: velocidadPrevia } = opciones;
  const supabase = createAdminClient();
  const modo = analysisMode();
  // El tope se lee una vez por corrida: define si hay búsqueda, qué dice el
  // prompt y qué method_version se guarda. En mock no se busca nunca.
  const tope = modo === "mock" ? 0 : topeBusquedas();
  const methodVersion =
    modo === "mock" ? MOCK_METHOD_VERSION : methodVersionLive(tope > 0);

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
      return (await marcarFallido(
        supabase,
        diagnosticId,
        "El diagnóstico no tiene empresa asociada",
        methodVersion,
        // Todavía no llamamos a la API: no hay nada gastado que registrar.
        null,
        { retriable: false, persistir: persistirFallo },
      )) as Extract<RunAnalysisResult, { ok: false }>;
    }

    const company: CompanyForAnalysis = {
      name: companyRaw.name,
      website: companyRaw.website,
      industry: companyRaw.industry,
      province: companyRaw.province,
      competidores: await leerCompetidores(supabase, diagnostico.company_id),
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

    return { ok: true, diagnosticId, modo, tope, methodVersion, company, facts: factsLimpios };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error desconocido";
    return (await marcarFallido(supabase, diagnosticId, detalle, methodVersion, null, {
      retriable: true,
      persistir: persistirFallo,
    })) as Extract<RunAnalysisResult, { ok: false }>;
  }
}

/** 4-7 del análisis: con la interpretación ya hecha, marca el fallo o calcula
 *  el score y guarda el informe en 'preliminary'. */
export async function guardarAnalisis(
  prep: Preparacion,
  interpretacion: Interpretacion,
  { marcarFalloTransitorio: persistirFallo = true }: RunAnalysisOptions = {},
): Promise<RunAnalysisResult> {
  const supabase = createAdminClient();
  const { diagnosticId, modo, methodVersion, facts: factsLimpios } = prep;

  try {
    if (!interpretacion.ok) {
      return await marcarFallido(
        supabase,
        diagnosticId,
        interpretacion.error,
        methodVersion,
        interpretacion.uso,
        // El mock sale del código: si no cumple el esquema, reintentarlo da lo
        // mismo. Contra Claude, un fallo de la API merece reintento; una
        // respuesta que no validó después de todas las correcciones, no: el
        // reintento de Inngest arranca de cero y vuelve a pagar las búsquedas.
        {
          retriable: modo !== "mock" && interpretacion.retriable !== false,
          persistir: persistirFallo,
        },
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
      // Lo que la búsqueda no pudo confirmar viaja adentro de su propio
      // bloque, con su estado, no en esta lista.
      a_validar: factsLimpios.warnings,
      // Qué se buscó, qué devolvió y qué citó el modelo sin respaldo. Es la
      // nota de método del informe y la única forma de auditar de dónde salió
      // cada dato externo. No va cuando no hubo búsqueda.
      ...(interpretacion.investigacion
        ? { investigacion: interpretacion.investigacion }
        : {}),
      // Lo que leyó el código con `leer_pagina`: la tabla de medición de la
      // competencia sale de acá, no de lo que el modelo diga que vio.
      lecturas: interpretacion.lecturas,
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
    return await marcarFallido(supabase, diagnosticId, detalle, methodVersion, interpretacion.uso, {
      retriable: true,
      persistir: persistirFallo,
    });
  }
}

/** El análisis entero en un solo proceso: lo usan el modo mock y la ruta de
 *  dev. En modo live, la función de Inngest hace lo mismo pero partido en
 *  steps (lib/inngest/analisisPorPasos.ts), para que ninguna llamada a
 *  Claude corra adentro de la función y choque con su límite de duración. */
export async function runAnalysis(
  diagnosticId: string,
  opciones: RunAnalysisOptions = {},
): Promise<RunAnalysisResult> {
  const prep = await prepararAnalisis(diagnosticId, opciones);
  if (!prep.ok) return prep;

  try {
    // 3-4. Interpretación + validación, con correcciones. En modo mock cambia
    //      SOLO de dónde sale el JSON: la validación con zod y todo lo que
    //      sigue es exactamente el mismo camino.
    const interpretacion =
      prep.modo === "mock"
        ? interpretarMock(prep.company, prep.facts)
        : await pedirAnalisis(createAdminClient(), diagnosticId, prep.company, prep.facts, prep.tope);

    return await guardarAnalisis(prep, interpretacion, opciones);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error desconocido";
    // Un throw que no previmos: lo tratamos como transitorio y que Inngest
    // decida cuántas veces vale la pena volver a intentarlo. Puede caer antes
    // o después de la llamada a la API; desde acá no sabemos cuál, así que no
    // afirmamos un costo.
    return await marcarFallido(createAdminClient(), diagnosticId, detalle, prep.methodVersion, null, {
      retriable: true,
      persistir: opciones.marcarFalloTransitorio ?? true,
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
export async function registrarLlamada(
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

/** Los competidores que declaró la empresa en el formulario.
 *
 *  Va en su propia consulta y tolera el error a propósito: la columna
 *  `competidores` es nueva (docs/migracion-competidores.sql) y, si todavía no
 *  se corrió esa migración, pedirla en el SELECT principal haría fallar el
 *  análisis entero por un dato opcional. Sin competidores declarados la
 *  auditoría corre igual: los detecta la búsqueda. */
async function leerCompetidores(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("competidores")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.warn(
      `[analysis] no se pudieron leer los competidores de ${companyId} (¿falta docs/migracion-competidores.sql?): ${error.message}`,
    );
    return [];
  }

  return sanitizarCompetidores((data as { competidores?: unknown } | null)?.competidores as
    | unknown[]
    | null
    | undefined);
}

export type Interpretacion =
  | {
      ok: true;
      output: AnalysisOutput;
      uso: UsoAnalisis | null;
      investigacion: Investigacion | null;
      lecturas: LecturaPagina[];
    }
  | {
      ok: false;
      error: string;
      uso: UsoAnalisis | null;
      investigacion: Investigacion | null;
      lecturas: LecturaPagina[];
      /** false = reintentar desde cero daría lo mismo (la respuesta no validó
       *  ni con las correcciones). Sin el campo, se asume que sí. */
      retriable?: boolean;
    };

/** Camino MOCK: arma el output desde los facts en vez de pedírselo a Claude.
 *  Pasa por el MISMO `validar()` a propósito — serializa y re-parsea para que
 *  el mock recorra el mismo JSON.parse + zod que una respuesta real. Si el
 *  mock se desincroniza del esquema, falla acá igual que fallaría el modelo. */
export function interpretarMock(
  company: CompanyForAnalysis,
  facts: SiteFacts,
): Interpretacion {
  const evaluado = validar(JSON.stringify(buildMockOutput(company, facts)));
  if (!evaluado.ok) {
    return {
      ok: false,
      error: `El análisis mock no cumple el esquema: ${evaluado.error}`,
      uso: null,
      investigacion: null,
      lecturas: [],
    };
  }
  // uso null y no cero: el mock no llamó a la API, no es que salió gratis.
  // investigacion null: el mock no busca nada, deriva todo de los facts.
  return { ok: true, output: evaluado.output, uso: null, investigacion: null, lecturas: [] };
}

/** Llama a Claude y valida. Si el JSON no cumple el esquema, hace UN reintento
 *  mostrándole su propia salida y el error de validación.
 *
 *  Con `tope` mayor a cero la llamada lleva la herramienta de búsqueda web de
 *  Anthropic. Las búsquedas las ejecuta la API del lado del servidor y vuelven
 *  como bloques de la misma respuesta; nosotros no hacemos ninguna request.
 *  Eso cambia dos cosas:
 *  - El turno pasa de segundos a minutos, así que la llamada va por STREAMING:
 *    sin eso, un turno largo se cae por timeout de HTTP antes de terminar.
 *  - El bucle de la herramienta puede pausarse (`pause_turn`) y hay que
 *    reanudarlo (ver `completar`). */
/** Todo lo que define la conversación con Claude en modo live: el modelo, el
 *  system prompt, las herramientas y el primer mensaje. Lo usan
 *  `pedirAnalisis` (un solo proceso) y la función de Inngest por pasos; es
 *  JSON puro para que Inngest lo pueda guardar como salida de un step. */
export type Conversacion = {
  modelo: string;
  system: string;
  herramientas: Anthropic.Messages.ToolUnion[];
  primerMensaje: string;
  /** false = sin web_search en esta corrida: no hay investigación que auditar. */
  conBusqueda: boolean;
  tope: number;
};

export async function armarConversacion(
  supabase: ReturnType<typeof createAdminClient>,
  company: CompanyForAnalysis,
  facts: SiteFacts,
  tope: number,
): Promise<Conversacion | null> {
  // Se lee en cada corrida, no al cargar el módulo: un cambio en
  // Configuración tiene que valer para la próxima auditoría sin reiniciar.
  const { modelo } = await modeloDeAnalisis(supabase);
  if (!modelo) return null;

  // Qué variante del tool acepta este modelo la decide websearch.ts. null =
  // esta corrida no busca, y entonces el prompt tampoco pide los bloques de
  // investigación: un campo nombrado es un campo que se intenta llenar.
  const herramienta = herramientaBusqueda(modelo, tope, ubicacionDeBusqueda(company.province));
  const opcionesPrompt = { busquedas: herramienta ? tope : 0, lecturas: MAX_LECTURAS };

  return {
    modelo,
    system: buildSystemPrompt(opcionesPrompt),
    herramientas: [...(herramienta ? [herramienta] : []), herramientaLectura],
    primerMensaje: buildUserMessage(company, facts, opcionesPrompt),
    conBusqueda: herramienta !== null,
    tope,
  };
}

export const ERROR_SIN_MODELO =
  "No hay modelo configurado: elegí uno en Configuración o seteá ANTHROPIC_MODEL";

/** El pedido de corrección cuando la respuesta no validó. Le devolvemos el
 *  turno ENTERO, con los bloques de búsqueda adentro: si mandáramos solo el
 *  texto perdería lo que encontró y volvería a buscar (o, peor, lo
 *  completaría de memoria). La herramienta sigue declarada —sacarla
 *  invalidaría el caché del prefijo—, así que el pedido de no volver a buscar
 *  va explícito. */
export function mensajeCorreccion(error: string): string {
  return [
    `Ese JSON no cumple el esquema. Errores de validación: ${error}`,
    "Corregí TODOS los errores. Si un texto se pasa del máximo, reescribilo más corto (apuntá al máximo nominal del esquema, no al límite): no lo cortes a la mitad.",
    "No busques de nuevo, no leas páginas, no uses la ejecución de código para medir textos y no cambies los datos que ya verificaste. Devolvé el JSON completo corregido; solo JSON.",
  ].join("\n");
}

/** Por qué se cierra la investigación antes de que el modelo la dé por
 *  terminada: llegó al tope de gasto (permisoGasto en costo.ts) o usó todas
 *  las búsquedas de la auditoría (conBusquedasRestantes en websearch.ts). */
export type MotivoCierre = "presupuesto" | "busquedas";

/** El pedido de cierre. Va con `tool_choice: none`: el modelo ya no puede
 *  buscar ni leer, así que esta llamada es la última de la investigación. */
export function pedidoCierre(motivo: MotivoCierre): string {
  return [
    motivo === "presupuesto"
      ? "Se agotó el presupuesto de esta auditoría: ya no podés buscar ni leer páginas."
      : "Se usaron todas las búsquedas de esta auditoría: desde acá ya no podés buscar ni leer páginas.",
    "Cerrá el análisis con lo que ya encontraste y devolvé el JSON completo. Lo que no llegaste a mirar va como \"a_validar\" o \"no_concluyente\", y un bloque sin evidencia no se devuelve: no completes nada de memoria. Solo JSON.",
  ].join("\n");
}

export const ERROR_TOPE_GASTO = (tope: number) =>
  `Se alcanzó el tope de gasto de la auditoría (USD ${tope}) sin un JSON válido`;

/** Por qué no arranca una auditoría: el diagnóstico ya gastó en corridas
 *  anteriores, o el tope no alcanza ni para empezar con este modelo (con Opus,
 *  la reserva para escribir el informe ronda USD 2,30 y hacen falta dos). No
 *  arrancar es a propósito: pagar la primera llamada y cortar después sería
 *  gastar sin informe. */
export const ERROR_TOPE_PREVIO = (previo: number, tope: number, modelo: string) =>
  previo > 0
    ? `Este diagnóstico ya gastó USD ${previo.toFixed(2)} en corridas anteriores y no queda margen dentro del tope (USD ${tope}) para una auditoría nueva. Para reprocesarlo, subí AUDITORIA_MAX_USD.`
    : `El tope de gasto (USD ${tope}) no alcanza para una auditoría con ${modelo}: no queda margen para investigar y escribir el informe. Subí AUDITORIA_MAX_USD o elegí un modelo más barato en Configuración.`;

/** Lo que ya se pagó por este diagnóstico en corridas anteriores, según el
 *  libro de gasto. Si el libro no se puede leer, 0: no conocer el pasado no
 *  frena una auditoría nueva, y lo de esta corrida se sigue controlando. */
export async function gastoPrevio(
  supabase: ReturnType<typeof createAdminClient>,
  diagnosticId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("analysis_costs")
    .select("costo_usd")
    .eq("diagnostic_id", diagnosticId);

  if (error) {
    console.warn(`[analysis] no se pudo leer el gasto previo de ${diagnosticId}: ${error.message}`);
    return 0;
  }
  return (data ?? []).reduce((suma, fila) => suma + Number(fila.costo_usd ?? 0), 0);
}

/** Los mensajes que cierran un turno que quedó abierto (el modelo pidió
 *  lecturas o la búsqueda se pausó) para pedirle el JSON.
 *
 *  - Lecturas pedidas: la API exige un `tool_result` por cada `tool_use`, así
 *    que se contestan todas como no hechas.
 *  - Turno pausado: puede terminar en una búsqueda lanzada sin resultado, que
 *    la API solo acepta como reanudación. Esos bloques se sacan; lo que ya
 *    tiene su resultado se conserva, así no se pierde lo investigado. */
export function mensajesDeCierre(
  respuesta: Anthropic.Message,
  motivo: MotivoCierre,
): Anthropic.MessageParam[] {
  const pedido = pedidoCierre(motivo);
  if (respuesta.stop_reason === "tool_use") {
    const noHechas: Anthropic.ToolResultBlockParam[] = respuesta.content
      .filter((bloque): bloque is Anthropic.ToolUseBlock => bloque.type === "tool_use")
      .map((bloque) => ({
        type: "tool_result",
        tool_use_id: bloque.id,
        content: "No se leyó: se agotó el presupuesto de la auditoría.",
        is_error: true,
      }));
    return [
      { role: "assistant", content: respuesta.content },
      { role: "user", content: [...noHechas, { type: "text", text: pedido }] },
    ];
  }

  const conResultado = new Set(
    respuesta.content.flatMap((bloque) =>
      "tool_use_id" in bloque && typeof bloque.tool_use_id === "string" ? [bloque.tool_use_id] : [],
    ),
  );
  const contenido = respuesta.content.filter(
    (bloque) => bloque.type !== "server_tool_use" || conResultado.has(bloque.id),
  );
  return [
    ...(contenido.length > 0 ? [{ role: "assistant" as const, content: contenido }] : []),
    { role: "user", content: pedido },
  ];
}

async function pedirAnalisis(
  supabase: ReturnType<typeof createAdminClient>,
  diagnosticId: string,
  company: CompanyForAnalysis,
  facts: SiteFacts,
  tope: number,
): Promise<Interpretacion> {
  const conversacion = await armarConversacion(supabase, company, facts, tope);
  if (!conversacion) {
    return { ok: false, error: ERROR_SIN_MODELO, uso: null, investigacion: null, lecturas: [] };
  }
  const { modelo: model, herramientas, system } = conversacion;
  const herramienta = conversacion.conBusqueda;
  const lecturas = registroInicial();

  // Se acumula acá y se devuelve pase lo que pase: un análisis que falló en la
  // validación igual consumió tokens y búsquedas, y hay que poder verlo en la
  // consola.
  let uso = usoInicial(model);
  // Todas las respuestas de la corrida —las reanudaciones y el reintento
  // incluidos—: de ahí sale el registro de qué se buscó.
  const respuestas: Anthropic.Message[] = [];

  const registrarInvestigacion = (output: AnalysisOutput | null) =>
    herramienta ? armarInvestigacion(output, extraerBusquedas(respuestas), tope) : null;

  const mensajes: Anthropic.MessageParam[] = [{ role: "user", content: conversacion.primerMensaje }];

  // Tope de gasto (costo.ts): pasado cierto gasto se deja de investigar y las
  // llamadas que quedan van sin herramientas, solo para cerrar el JSON. Cuenta
  // también lo que este diagnóstico ya pagó en corridas anteriores.
  const topeUsd = topeUsdAuditoria();
  const previo = await gastoPrevio(supabase, diagnosticId);
  if (permisoGasto(uso, topeUsd, previo) !== "seguir") {
    return {
      ok: false,
      error: ERROR_TOPE_PREVIO(previo, topeUsd, model),
      uso,
      investigacion: null,
      lecturas: [],
      retriable: false,
    };
  }
  let cerrando = false;
  // El cupo de búsquedas es de la auditoría, no de cada llamada
  // (conBusquedasRestantes en websearch.ts). En modo cierre no se toca: la
  // herramienta no se usa y cambiarla solo invalidaría el caché.
  let herramientasLlamada = herramientas;
  const busquedasRestantes = () => tope - uso.busquedasWeb;

  /** Una vuelta completa contra la API: reanuda el turno si se pausa y
   *  contesta las lecturas que pida el modelo, hasta que cierre. Devuelve null
   *  si el tope de gasto no deja ni cerrar. */
  const completar = async (): Promise<Anthropic.Message | null> => {
    for (let pausas = 0, vueltas = 0; ; ) {
      if (herramienta && !cerrando) {
        herramientasLlamada = conBusquedasRestantes(herramientas, busquedasRestantes());
      }
      const respuesta = await getAnthropic()
        .messages.stream({
          model,
          max_tokens: MAX_TOKENS,
          system,
          messages: mensajes,
          tools: herramientasLlamada,
          ...(cerrando ? { tool_choice: { type: "none" as const } } : {}),
          // Caché automático: marca el último bloque del pedido, así que las
          // vueltas internas de la búsqueda y las llamadas siguientes releen el
          // contexto ya leído al 10% del precio. Sin esto, una corrida releyó
          // 3,8 millones de tokens a precio completo (USD 8 de USD 10).
          cache_control: { type: "ephemeral" },
        })
        .finalMessage();

      uso = acumularUso(uso, respuesta.usage);
      // Al libro de gasto apenas vuelve la llamada: si algo tira después, o el
      // diagnóstico se reintenta o se borra, lo pagado ya quedó registrado.
      await registrarLlamada(supabase, {
        diagnosticId,
        empresa: company.name,
        uso: acumularUso(usoInicial(model), respuesta.usage),
      });
      respuestas.push(respuesta);

      const abierto =
        (respuesta.stop_reason === "tool_use" && vueltas < MAX_VUELTAS_LECTURA) ||
        (respuesta.stop_reason === "pause_turn" && pausas < MAX_PAUSAS);
      if (!abierto) return respuesta;

      const permiso = permisoGasto(uso, topeUsd, previo);
      if (permiso === "cortar") return null;
      if (permiso === "cerrar") {
        cerrando = true;
        mensajes.push(...mensajesDeCierre(respuesta, "presupuesto"));
        continue;
      }

      // Sin búsquedas no se sigue investigando. Las lecturas que ya pidió sí
      // se hacen: las corre nuestro código, no cuestan tokens de búsqueda, y la
      // tabla de la competencia sale de ahí. Después, a cerrar.
      const sinBusquedas = herramienta && busquedasRestantes() <= 0;

      if (respuesta.stop_reason === "tool_use") {
        // leer_pagina es nuestra: la API frena, leemos y le devolvemos lo que
        // encontró el código. El turno sigue desde ahí.
        vueltas += 1;
        const resultados = await ejecutarLecturas(respuesta, lecturas, facts.domain);
        mensajes.push(
          { role: "assistant", content: respuesta.content },
          {
            role: "user",
            content: sinBusquedas
              ? [...resultados, { type: "text", text: pedidoCierre("busquedas") }]
              : resultados,
          },
        );
        if (sinBusquedas) cerrando = true;
        continue;
      }

      if (sinBusquedas) {
        cerrando = true;
        mensajes.push(...mensajesDeCierre(respuesta, "busquedas"));
        continue;
      }

      // Reanudar es devolverle su propio turno: la API ve el bloque de
      // herramienta al final y sigue sola. NO se le agrega un "continuá".
      pausas += 1;
      mensajes.push({ role: "assistant", content: respuesta.content });
    }
  };

  const cortePorGasto = (): Interpretacion => ({
    ok: false,
    error: ERROR_TOPE_GASTO(topeUsd),
    uso,
    investigacion: registrarInvestigacion(null),
    lecturas: lecturas.lecturas,
    retriable: false,
  });

  for (let intento = 1; intento <= INTENTOS_VALIDACION; intento += 1) {
    const respuesta = await completar();
    if (!respuesta) return cortePorGasto();

    if (respuesta.stop_reason === "refusal") {
      return {
        ok: false,
        error: "El modelo declinó responder el análisis",
        uso,
        investigacion: registrarInvestigacion(null),
        lecturas: lecturas.lecturas,
      };
    }

    if (respuesta.stop_reason === "max_tokens") {
      return {
        ok: false,
        error: `La respuesta se truncó en max_tokens (${MAX_TOKENS}): el JSON quedó incompleto`,
        uso,
        investigacion: registrarInvestigacion(null),
        lecturas: lecturas.lecturas,
      };
    }

    if (respuesta.stop_reason === "tool_use") {
      return {
        ok: false,
        error: `El modelo siguió pidiendo lecturas después de ${MAX_VUELTAS_LECTURA} vueltas sin cerrar el análisis`,
        uso,
        investigacion: registrarInvestigacion(null),
        lecturas: lecturas.lecturas,
      };
    }

    if (respuesta.stop_reason === "pause_turn") {
      return {
        ok: false,
        error: `El turno se pausó ${MAX_PAUSAS} veces sin cerrar el análisis`,
        uso,
        investigacion: registrarInvestigacion(null),
        lecturas: lecturas.lecturas,
      };
    }

    const evaluado = validarRespuesta(respuesta);
    if (evaluado.ok) {
      return {
        ok: true,
        output: evaluado.output,
        uso,
        investigacion: registrarInvestigacion(evaluado.output),
        lecturas: lecturas.lecturas,
      };
    }

    // Último intento agotado: devolvemos el motivo real, no un genérico.
    if (intento === INTENTOS_VALIDACION) {
      return {
        ok: false,
        error: `La respuesta no cumple el esquema tras ${INTENTOS_VALIDACION - 1} correcciones: ${evaluado.error}`,
        uso,
        investigacion: registrarInvestigacion(null),
        lecturas: lecturas.lecturas,
        retriable: false,
      };
    }

    // La corrección también se paga: si no entra en el tope, se corta acá.
    const permiso = permisoGasto(uso, topeUsd, previo);
    if (permiso === "cortar") return cortePorGasto();
    if (permiso === "cerrar") cerrando = true;

    mensajes.push(
      { role: "assistant", content: respuesta.content },
      { role: "user", content: mensajeCorreccion(evaluado.error) },
    );
  }

  return {
    ok: false,
    error: "No se obtuvo un análisis válido",
    uso,
    investigacion: registrarInvestigacion(null),
    lecturas: lecturas.lecturas,
  };
}

export type Validacion =
  | { ok: true; output: AnalysisOutput }
  /** `esJson` distingue "no era JSON" de "era JSON pero no cumple": con varios
   *  candidatos, el error del que SÍ parseó es el que sirve para corregir. */
  | { ok: false; error: string; esJson: boolean };

/** Valida la respuesta probando los candidatos a JSON que tenga.
 *
 *  Sin herramientas la respuesta es un solo bloque de texto con el JSON. Con
 *  búsqueda web el modelo escribe entre búsqueda y búsqueda, así que puede
 *  haber varios bloques y el JSON ser solo el último. Probamos, en orden: el
 *  último bloque, el texto completo, y el recorte entre la primera llave y la
 *  última. Si ninguno valida, devolvemos el error del primero que al menos
 *  haya sido JSON. */
export function validarRespuesta(respuesta: Anthropic.Message): Validacion {
  const candidatos = candidatosJson(respuesta);
  if (candidatos.length === 0) {
    return { ok: false, error: "la respuesta vino vacía", esJson: false };
  }

  let primerFallo: Validacion | null = null;
  let falloConJson: Validacion | null = null;

  for (const candidato of candidatos) {
    const evaluado = validar(candidato);
    if (evaluado.ok) return evaluado;
    primerFallo ??= evaluado;
    if (evaluado.esJson) falloConJson ??= evaluado;
  }

  return falloConJson ?? primerFallo ?? { ok: false, error: "no se pudo validar", esJson: false };
}

function candidatosJson(respuesta: Anthropic.Message): string[] {
  const textos = respuesta.content
    .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
    .map((bloque) => bloque.text.trim())
    .filter(Boolean);

  if (textos.length === 0) return [];

  const completo = textos.join("\n").trim();
  const candidatos = [textos[textos.length - 1], completo];

  const desde = completo.indexOf("{");
  const hasta = completo.lastIndexOf("}");
  if (desde >= 0 && hasta > desde) candidatos.push(completo.slice(desde, hasta + 1));

  return [...new Set(candidatos)];
}

function validar(texto: string): Validacion {
  const limpio = quitarCercas(texto);
  if (!limpio) return { ok: false, error: "la respuesta vino vacía", esJson: false };

  let crudo: unknown;
  try {
    crudo = JSON.parse(limpio);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "JSON inválido";
    return { ok: false, error: `no es JSON parseable (${detalle})`, esJson: false };
  }

  const validado = analysisOutput.safeParse(crudo);
  if (!validado.success) {
    const problemas = validado.error.issues
      .slice(0, 25)
      .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: problemas, esJson: true };
  }

  return { ok: true, output: validado.data };
}

/** El prompt pide JSON pelado, pero si igual viene envuelto en ```json lo
 *  desenvolvemos en vez de gastar el reintento en eso. */
function quitarCercas(texto: string): string {
  const limpio = texto.trim();
  const cercado = limpio.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return (cercado ? cercado[1] : limpio).trim();
}

export async function marcarFallido(
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
