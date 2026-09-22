import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, NonRetriableError, type GetStepTools } from "inngest";

import {
  armarConversacion,
  ERROR_SIN_MODELO,
  ERROR_TOPE_GASTO,
  ERROR_TOPE_PREVIO,
  gastoPrevio,
  guardarAnalisis,
  INTENTOS_VALIDACION,
  interpretarMock,
  MAX_PAUSAS,
  MAX_TOKENS,
  MAX_VUELTAS_LECTURA,
  mensajeCorreccion,
  mensajesDeCierre,
  pedidoCierre,
  prepararAnalisis,
  registrarLlamada,
  validarRespuesta,
  type Interpretacion,
  type Preparacion,
  type RunAnalysisResult,
} from "@/lib/analysis/analyze";
import type { PageSpeedFacts } from "@/lib/analysis/collectors/pageSpeed";
import {
  acumularUso,
  permisoGasto,
  topeUsdAuditoria,
  usoInicial,
  type UsoAnalisis,
} from "@/lib/analysis/costo";
import { ejecutarLecturas, type LecturaPagina } from "@/lib/analysis/lecturas";
import {
  armarInvestigacion,
  conBusquedasRestantes,
  extraerBusquedas,
} from "@/lib/analysis/websearch";
import { createAdminClient } from "@/lib/supabase/admin";
import type { inngest } from "./client";

/** El análisis partido en steps de Inngest.
 *
 *  Por qué: la ruta /api/inngest tiene `maxDuration = 300` y una auditoría con
 *  búsqueda tarda 10-15 minutos, con llamadas a Claude de hasta 7 minutos cada
 *  una. Con `step.ai.infer` la llamada la hace el servidor de Inngest: la
 *  función queda pausada mientras tanto, sin contar para su duración. Lo que
 *  sí corre en la función (leer la base, recolectar, leer páginas, validar,
 *  guardar) tarda segundos por step.
 *
 *  Además, cada step queda memorizado: si algo falla a la mitad, Inngest
 *  reintenta ese step, no la corrida entera, y las búsquedas no se vuelven a
 *  pagar.
 *
 *  Todo lo que está FUERA de un step se vuelve a ejecutar cada vez que Inngest
 *  llama a la función (así reconstruye el estado), así que tiene que ser
 *  determinista: se arma solo con salidas de steps ya memorizadas. */

type Step = GetStepTools<typeof inngest>;

export async function analizarPorPasos(
  step: Step,
  diagnosticId: string,
  velocidad: PageSpeedFacts | null,
): Promise<Extract<RunAnalysisResult, { ok: true }>> {
  // Los fallos transitorios no se escriben desde los steps: se relanzan para
  // que Inngest reintente, y si se agotan los reintentos, el `onFailure` de
  // la función marca el diagnóstico. Los permanentes sí se escriben enseguida.
  const opciones = { marcarFalloTransitorio: false, pageSpeed: velocidad ?? undefined };

  const preparado = await step.run("preparar", async () => {
    const salida = await prepararAnalisis(diagnosticId, opciones);
    if (!salida.ok && salida.retriable) throw new Error(salida.error);
    return salida;
  });
  if (!preparado.ok) throw new NonRetriableError(preparado.error);
  const prep = preparado as unknown as Preparacion;

  // Mock: sale del código, en milisegundos. Un solo step alcanza.
  if (prep.modo === "mock") {
    return cerrar(step, "guardar", prep, () => interpretarMock(prep.company, prep.facts));
  }

  const conversacion = await step.run("conversacion", () =>
    armarConversacion(createAdminClient(), prep.company, prep.facts, prep.tope),
  );
  if (!conversacion) {
    return cerrar(step, "guardar", prep, () => ({
      ok: false,
      error: ERROR_SIN_MODELO,
      uso: null,
      investigacion: null,
      lecturas: [],
      retriable: false,
    }));
  }

  const modelo = anthropic({
    model: conversacion.modelo,
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultParameters: { max_tokens: MAX_TOKENS },
  });

  const mensajes: Anthropic.MessageParam[] = [{ role: "user", content: conversacion.primerMensaje }];
  const respuestas: Anthropic.Message[] = [];
  const lecturas: LecturaPagina[] = [];
  let pausas = 0;
  let vueltasLectura = 0;
  let correcciones = 0;
  // Tope de gasto (costo.ts). Se decide con `uso()`, que sale de respuestas
  // memorizadas: al reconstruir la función da lo mismo que la primera vez.
  const topeUsd = topeUsdAuditoria();
  let cerrando = false;

  const uso = (): UsoAnalisis =>
    respuestas.reduce((total, r) => acumularUso(total, r.usage), usoInicial(conversacion.modelo));
  const investigacion = (output: Extract<Interpretacion, { ok: true }>["output"] | null) =>
    conversacion.conBusqueda
      ? armarInvestigacion(output, extraerBusquedas(respuestas), conversacion.tope)
      : null;
  // Permanente por defecto: el step que guarda no vuelve a llamar a Claude, así
  // que reintentarlo daría el mismo fallo.
  const fallo = (error: string, retriable = false): Interpretacion => ({
    ok: false,
    error,
    uso: uso(),
    investigacion: investigacion(null),
    lecturas,
    retriable,
  });

  // El tope es por diagnóstico: lo que ya pagaron corridas anteriores (un
  // reproceso, un evento repetido) cuenta. Memorizado, como todo lo que se
  // usa para decidir: al reconstruir la función tiene que dar lo mismo.
  const previo = await step.run("gasto-previo", () =>
    gastoPrevio(createAdminClient(), diagnosticId),
  );
  if (permisoGasto(uso(), topeUsd, previo) !== "seguir") {
    return cerrar(step, "guardar", prep, () => fallo(ERROR_TOPE_PREVIO(previo, topeUsd, conversacion.modelo)));
  }

  // El cupo de búsquedas es de la auditoría, no de cada llamada
  // (conBusquedasRestantes en websearch.ts). En modo cierre no se toca: la
  // herramienta no se usa y cambiarla solo invalidaría el caché.
  let herramientas = conversacion.herramientas;
  const busquedasRestantes = () => conversacion.tope - uso().busquedasWeb;

  for (let n = 0; ; n += 1) {
    if (conversacion.conBusqueda && !cerrando) {
      herramientas = conBusquedasRestantes(conversacion.herramientas, busquedasRestantes());
    }
    // Los tipos del adaptador de Inngest son de una API vieja (no conocen
    // web_search ni pause_turn), pero el cuerpo y la respuesta pasan crudos:
    // se probó con una llamada real. Por eso los casts.
    const respuesta = (await step.ai.infer(`claude-${n}`, {
      model: modelo,
      body: {
        system: conversacion.system,
        messages: mensajes,
        tools: herramientas,
        // Caché automático: las vueltas internas de la búsqueda y las llamadas
        // siguientes releen el contexto ya leído al 10% del precio (ver
        // pedirAnalisis en analyze.ts).
        cache_control: { type: "ephemeral" },
        ...(cerrando ? { tool_choice: { type: "none" } } : {}),
      } as never,
    })) as unknown as Anthropic.Message;
    respuestas.push(respuesta);

    // Al libro de gasto apenas vuelve: si algo falla después, lo pagado quedó.
    await step.run(`gasto-${n}`, () =>
      registrarLlamada(createAdminClient(), {
        diagnosticId,
        empresa: prep.company.name,
        uso: acumularUso(usoInicial(conversacion.modelo), respuesta.usage),
      }),
    );

    const abierto =
      (respuesta.stop_reason === "tool_use" && vueltasLectura < MAX_VUELTAS_LECTURA) ||
      (respuesta.stop_reason === "pause_turn" && pausas < MAX_PAUSAS);
    if (abierto) {
      const permiso = permisoGasto(uso(), topeUsd, previo);
      if (permiso === "cortar") return cerrar(step, "guardar", prep, () => fallo(ERROR_TOPE_GASTO(topeUsd)));
      if (permiso === "cerrar") {
        // Se deja de investigar: lo que el modelo pidió queda sin hacer y la
        // próxima llamada va sin herramientas.
        cerrando = true;
        mensajes.push(...mensajesDeCierre(respuesta, "presupuesto"));
        continue;
      }
    }

    // Sin búsquedas no se sigue investigando. Las lecturas que ya pidió sí se
    // hacen (abajo): las corre nuestro código y la tabla de la competencia
    // sale de ahí. Después, a cerrar.
    const sinBusquedas = abierto && conversacion.conBusqueda && busquedasRestantes() <= 0;
    if (sinBusquedas && respuesta.stop_reason === "pause_turn") {
      cerrando = true;
      mensajes.push(...mensajesDeCierre(respuesta, "busquedas"));
      continue;
    }

    if (respuesta.stop_reason === "tool_use" && vueltasLectura < MAX_VUELTAS_LECTURA) {
      vueltasLectura += 1;
      // El cupo de lecturas se reconstruye de las salidas anteriores, así el
      // tope vale para toda la corrida aunque cada vuelta sea otro step.
      const hechas = lecturas.length;
      const salida = await step.run(`lecturas-${n}`, async () => {
        const registro = { reservadas: hechas, lecturas: [] as LecturaPagina[] };
        const resultados = await ejecutarLecturas(respuesta, registro, prep.facts.domain);
        return { resultados, nuevas: registro.lecturas };
      });
      lecturas.push(...(salida.nuevas as LecturaPagina[]));
      const resultados = salida.resultados as Anthropic.ToolResultBlockParam[];
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

    if (respuesta.stop_reason === "pause_turn" && pausas < MAX_PAUSAS) {
      // Reanudar es devolverle su propio turno; no se agrega un "continuá".
      pausas += 1;
      mensajes.push({ role: "assistant", content: respuesta.content });
      continue;
    }

    const razon = respuesta.stop_reason as string;
    if (razon === "refusal") return cerrar(step, "guardar", prep, () => fallo("El modelo declinó responder el análisis"));
    if (razon === "max_tokens") {
      return cerrar(step, "guardar", prep, () =>
        fallo(`La respuesta se truncó en max_tokens (${MAX_TOKENS}): el JSON quedó incompleto`),
      );
    }
    if (razon === "tool_use" || razon === "pause_turn") {
      return cerrar(step, "guardar", prep, () =>
        fallo("El modelo no cerró el análisis dentro del tope de vueltas"),
      );
    }

    // La validación es pura (sale de una respuesta ya memorizada): no hace
    // falta un step para ella.
    const evaluado = validarRespuesta(respuesta);
    if (evaluado.ok) {
      const output = evaluado.output;
      return cerrar(step, "guardar", prep, () => ({
        ok: true,
        output,
        uso: uso(),
        investigacion: investigacion(output),
        lecturas,
      }));
    }

    if (correcciones >= INTENTOS_VALIDACION - 1) {
      return cerrar(step, "guardar", prep, () =>
        fallo(`La respuesta no cumple el esquema tras ${correcciones} correcciones: ${evaluado.error}`),
      );
    }
    // La corrección también se paga: si no entra en el tope, se corta acá.
    const permiso = permisoGasto(uso(), topeUsd);
    if (permiso === "cortar") return cerrar(step, "guardar", prep, () => fallo(ERROR_TOPE_GASTO(topeUsd)));
    if (permiso === "cerrar") cerrando = true;

    correcciones += 1;
    mensajes.push(
      { role: "assistant", content: respuesta.content },
      { role: "user", content: mensajeCorreccion(evaluado.error) },
    );
  }
}

/** El último step: guarda el informe o el fallo. Un fallo transitorio al
 *  guardar (la base) se relanza para que Inngest reintente solo este step. */
async function cerrar(
  step: Step,
  id: string,
  prep: Preparacion,
  interpretar: () => Interpretacion,
): Promise<Extract<RunAnalysisResult, { ok: true }>> {
  const interpretacion = interpretar();
  const resultado = (await step.run(id, async () => {
    const salida = await guardarAnalisis(prep, interpretacion, { marcarFalloTransitorio: false });
    if (!salida.ok && salida.retriable) throw new Error(salida.error);
    return salida;
  })) as RunAnalysisResult;

  if (!resultado.ok) throw new NonRetriableError(resultado.error);
  return resultado;
}
