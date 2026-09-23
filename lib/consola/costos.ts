import "server-only";

import { calcularCosto, type UsoAnalisis } from "@/lib/analysis/costo";
import { createServerSupabase } from "@/lib/supabase/server";

/** Lectura del gasto de la API para la consola.
 *
 *  Va en su propio módulo, con sus propias queries, a propósito: las columnas
 *  `analysis_cost_usd` / `analysis_usage` las agrega `docs/costos-analisis.sql`
 *  a mano en Supabase. Si se sumaran al select grande de `queries.ts`, una base
 *  sin la migración haría fallar la query entera y el detalle del diagnóstico
 *  se caería por un dato accesorio. Acá un fallo devuelve `null` y la UI
 *  muestra que falta correr la migración. */

export type GastoDiagnostico = {
  costoUsd: number | null;
  uso: UsoAnalisis | null;
};

export type GastoGlobal = {
  /** Suma de todo lo gastado, en dólares. */
  totalUsd: number;
  /** Gastado en los últimos 30 días. */
  ultimos30Usd: number;
  /** Cuántos diagnósticos tienen costo registrado. */
  conCosto: number;
  /** Promedio por diagnóstico con costo. */
  promedioUsd: number;
  /** De dónde sale el número. "registro" = `analysis_costs`, que conserva lo
   *  gastado aunque se borre el diagnóstico. "diagnosticos" = el fallback de
   *  antes de docs/registro-gasto.sql, que pierde lo borrado y lo reintentado. */
  fuente: "registro" | "diagnosticos";
};

/** `null` = las columnas no existen todavía (falta correr la migración) o la
 *  consulta falló. La UI lo distingue de "existe y vale cero". */
export async function gastoDeDiagnostico(id: string): Promise<GastoDiagnostico | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("diagnostics")
    .select("analysis_cost_usd, analysis_usage")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const uso = (data.analysis_usage ?? null) as UsoAnalisis | null;

  return {
    // numeric vuelve como string desde PostgREST: sin el Number() la suma
    // concatenaría en vez de sumar.
    costoUsd: data.analysis_cost_usd == null ? null : Number(data.analysis_cost_usd),
    uso,
  };
}

type FilaGasto = { diagnostic_id: string; costo: string | number; created_at: string };

/** El gasto total sale del libro `analysis_costs` (docs/registro-gasto.sql):
 *  una fila por llamada a la API que no se borra con el diagnóstico ni se pisa
 *  con un reintento. Si la tabla todavía no existe, cae a sumar las columnas
 *  de `diagnostics`, como antes, y lo avisa con `fuente`. */
export async function gastoGlobal(): Promise<GastoGlobal | null> {
  const supabase = await createServerSupabase();

  // Sin vista ni RPC, PostgREST no hace SUM: traemos los valores y sumamos
  // acá. A este volumen es intrascendente; si algún día son miles de filas,
  // esto pasa a ser una vista.
  const registro = await supabase
    .from("analysis_costs")
    .select("diagnostic_id, costo:costo_usd, created_at");

  if (!registro.error) {
    return resumirGasto((registro.data ?? []) as FilaGasto[], "registro");
  }

  const { data, error } = await supabase
    .from("diagnostics")
    .select("diagnostic_id:id, costo:analysis_cost_usd, created_at")
    .not("analysis_cost_usd", "is", null);

  if (error) return null;
  return resumirGasto((data ?? []) as FilaGasto[], "diagnosticos");
}

/** Suma por llamada para el total y los últimos 30 días, y agrupa por
 *  diagnóstico para el promedio y el máximo: un análisis con reintentos es UN
 *  análisis que costó la suma de sus llamadas. */
function resumirGasto(filas: FilaGasto[], fuente: GastoGlobal["fuente"]): GastoGlobal {
  const corte = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let totalUsd = 0;
  let ultimos30Usd = 0;
  const porDiagnostico = new Map<string, number>();

  for (const fila of filas) {
    // numeric vuelve como string desde PostgREST.
    const costo = Number(fila.costo);
    if (!Number.isFinite(costo)) continue;
    totalUsd += costo;
    porDiagnostico.set(fila.diagnostic_id, (porDiagnostico.get(fila.diagnostic_id) ?? 0) + costo);
    const cuando = new Date(fila.created_at).getTime();
    if (Number.isFinite(cuando) && cuando >= corte) ultimos30Usd += costo;
  }

  const conCosto = porDiagnostico.size;

  return {
    totalUsd: redondear(totalUsd),
    ultimos30Usd: redondear(ultimos30Usd),
    conCosto,
    promedioUsd: conCosto === 0 ? 0 : redondear(totalUsd / conCosto),
    fuente,
  };
}

/** Cuántos diagnósticos más entran con un crédito dado.
 *
 *  El saldo NO lo podemos leer: la API de Anthropic no expone crédito
 *  restante por ningún endpoint (el Admin API informa gasto, no saldo, y
 *  además pide una Admin key que las cuentas individuales no tienen). Así que
 *  el saldo lo carga el equipo a mano y esto solo hace la división. */
export function diagnosticosPorDelante(saldoUsd: number, promedioUsd: number): number | null {
  if (!Number.isFinite(saldoUsd) || saldoUsd <= 0) return null;
  if (!Number.isFinite(promedioUsd) || promedioUsd <= 0) return null;
  return Math.floor(saldoUsd / promedioUsd);
}

/** Recalcula el costo desde el uso guardado. Sirve para mostrar en la consola
 *  qué costaría hoy un análisis viejo si los precios cambiaron — sin tocar el
 *  costo histórico, que es el que se pagó de verdad. */
export function costoAPreciosDeHoy(uso: UsoAnalisis | null): number | null {
  if (!uso) return null;
  return calcularCosto(uso);
}

function redondear(dolares: number): number {
  return Math.round(dolares * 1e6) / 1e6;
}
