import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  CANALES_MADUREZ,
  ESTADOS_LEAD,
  type CanalMadurez,
  type EstadoLead,
} from "@/lib/consola/leads";

/** Lecturas de la consola.
 *
 *  Todo pasa por el cliente CON sesión (lib/supabase/server), no por el admin:
 *  esto es lectura autenticada del equipo y tiene que quedar sujeta a las
 *  policies de SELECT (docs/rls-policies.sql). El service_role queda para el
 *  pipeline y el form público, que corren sin usuario.
 *
 *  Criterio general: contar en Postgres (`head: true`, payload cero) y traer
 *  solo las columnas que se muestran. En particular `results` nunca se baja
 *  entero: incluye `facts`, con el listado completo de URLs internas del
 *  sitio analizado. */

/** Una empresa como la devuelve el join. Supabase infiere el embed como
 *  objeto o array según el caso, así que se normaliza con `unoDe`. */
export type EmpresaFila = {
  name: string;
  website: string | null;
  province: string | null;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
};

export type DiagnosticoFila = {
  id: string;
  created_at: string;
  status: string;
  lead_status: EstadoLead | null;
  score_general: number | null;
  empresa: EmpresaFila | null;
};

function unoDe<T>(valor: T | T[] | null): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

/* ----------------------------------------------------------------
 * Conteos
 * ---------------------------------------------------------------- */

export type ConteosLead = Record<EstadoLead, number> & { total: number };

/** Un count por estado + el total, en paralelo y con `head: true`: cuenta
 *  Postgres y no viaja ni una fila. Alimenta los tiles del panel, el embudo y
 *  los contadores de los filtros de la tabla. */
export async function contarLeads(): Promise<ConteosLead> {
  const supabase = await createServerSupabase();

  const contar = async (estado?: EstadoLead) => {
    let query = supabase.from("diagnostics").select("*", { count: "exact", head: true });
    if (estado) query = query.eq("lead_status", estado);
    const { count } = await query;
    return count ?? 0;
  };

  const [total, ...porEstado] = await Promise.all([
    contar(),
    ...ESTADOS_LEAD.map((estado) => contar(estado)),
  ]);

  const conteos = { total } as ConteosLead;
  ESTADOS_LEAD.forEach((estado, i) => {
    conteos[estado] = porEstado[i];
  });
  return conteos;
}

/* ----------------------------------------------------------------
 * Madurez promedio general
 * ---------------------------------------------------------------- */

/** PostgREST sabe hacer avg(), pero las funciones de agregación dependen de
 *  que estén habilitadas en el proyecto, así que no se asume. Se trae una
 *  sola columna numérica de las filas ya puntuadas y se promedia acá: con el
 *  volumen de la consola es irrelevante, y si algún día molesta se resuelve
 *  con una vista. */
export async function madurezPromedio(): Promise<number | null> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("diagnostics")
    .select("score_general")
    .not("score_general", "is", null);

  const scores = (data ?? [])
    .map((fila) => Number(fila.score_general))
    .filter((n) => Number.isFinite(n));

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/* ----------------------------------------------------------------
 * Rubros
 * ---------------------------------------------------------------- */

export type Rubro = { nombre: string; cantidad: number };

/** Agrupar en SQL pediría una vista o un RPC; por ahora se trae una sola
 *  columna de texto y se cuenta acá. Si esto crece, la versión buena es una
 *  vista con `select industry, count(*) ... group by industry`. */
export async function rubrosMasDiagnosticados(limite = 5): Promise<Rubro[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("companies")
    .select("industry")
    .not("industry", "is", null);

  const cuenta = new Map<string, number>();
  for (const fila of data ?? []) {
    const rubro = (fila.industry ?? "").trim();
    if (!rubro) continue;
    cuenta.set(rubro, (cuenta.get(rubro) ?? 0) + 1);
  }

  return [...cuenta.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, limite);
}

/* ----------------------------------------------------------------
 * Madurez por canal
 * ---------------------------------------------------------------- */

export type MadurezCanal = { id: CanalMadurez; label: string; promedio: number; base: number };

/** La madurez de cada canal vive dentro del jsonb `results` (escala 1 a 5).
 *  Se proyectan SOLO esos tres paths con la sintaxis `->` de PostgREST, así el
 *  results completo se queda en la base. A futuro, si esto se consulta
 *  seguido, conviene materializar `madurez_sitio` / `madurez_seo` /
 *  `madurez_medicion` como columnas generadas y ordenar por ellas. */
export async function madurezPorCanal(): Promise<MadurezCanal[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("diagnostics")
    .select(
      "sitio:results->infra->sitio->madurez, seo:results->infra->seo->madurez, medicion:results->infra->medicion->madurez",
    )
    .in("status", ["preliminary", "sent"]);

  const filas = (data ?? []) as unknown as Record<CanalMadurez, unknown>[];

  return CANALES_MADUREZ.map(({ id, label }) => {
    const valores = filas
      .map((fila) => Number(fila[id]))
      .filter((n) => Number.isFinite(n) && n > 0);

    // Sobre 5, expresado en porcentaje para la barra.
    const promedio =
      valores.length === 0
        ? 0
        : Math.round((valores.reduce((a, b) => a + b, 0) / valores.length / 5) * 100);

    return { id, label, promedio, base: valores.length };
  });
}

/* ----------------------------------------------------------------
 * Filas
 * ---------------------------------------------------------------- */

const COLUMNAS_EMPRESA = "name, website, province, industry, contact_name, contact_email";

const COLUMNAS_FILA = `id, created_at, status, lead_status, score_general, companies(${COLUMNAS_EMPRESA})`;

type FilaCruda = Omit<DiagnosticoFila, "empresa"> & {
  companies: EmpresaFila | EmpresaFila[] | null;
};

function normalizar(filas: FilaCruda[]): DiagnosticoFila[] {
  return filas.map(({ companies, ...resto }) => ({ ...resto, empresa: unoDe(companies) }));
}

/** Los últimos que entraron y todavía nadie tocó. */
export async function ultimosNuevos(limite = 5): Promise<DiagnosticoFila[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("diagnostics")
    .select(COLUMNAS_FILA)
    .eq("lead_status", "nuevo")
    .order("created_at", { ascending: false })
    .limit(limite);

  return normalizar((data ?? []) as unknown as FilaCruda[]);
}

/** Listado de la tabla. El filtro por estado se resuelve en la base: la
 *  página lo lee del query param, así el estado vive en la URL. */
export async function listarDiagnosticos(estado?: EstadoLead): Promise<DiagnosticoFila[]> {
  const supabase = await createServerSupabase();

  let query = supabase
    .from("diagnostics")
    .select(COLUMNAS_FILA)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("lead_status", estado);

  const { data } = await query;
  return normalizar((data ?? []) as unknown as FilaCruda[]);
}

export type DiagnosticoDetalle = DiagnosticoFila & {
  score_infra: number | null;
  score_marca: number | null;
  method_version: string | null;
  reviewed_by: string | null;
  updated_at: string | null;
  /** El token del informe público. null si por algún motivo no se creó. */
  token: string | null;
  /** Crudo: lo parsea la página con el esquema interno (lib/consola/facts). */
  results: unknown;
};

/** El detalle interno. Acá SÍ se trae `results` completo —con `facts`— porque
 *  la vista del equipo tiene que poder auditar de dónde salió cada hallazgo.
 *  La página lo renderiza en el servidor: el blob no viaja como props a
 *  ningún componente cliente. */
export async function diagnosticoCompleto(id: string): Promise<DiagnosticoDetalle | null> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("diagnostics")
    .select(
      `id, created_at, updated_at, status, lead_status, score_general, score_infra, score_marca,
       method_version, reviewed_by, results,
       companies(${COLUMNAS_EMPRESA}), share_tokens(token)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const fila = data as unknown as FilaCruda & {
    score_infra: number | null;
    score_marca: number | null;
    method_version: string | null;
    reviewed_by: string | null;
    updated_at: string | null;
    results: unknown;
    share_tokens: { token: string } | { token: string }[] | null;
  };

  const { companies, share_tokens, ...resto } = fila;

  return {
    ...resto,
    empresa: unoDe(companies),
    token: unoDe(share_tokens)?.token ?? null,
  };
}
