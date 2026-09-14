/** Vocabulario compartido de la consola: estados, etiquetas y formato.
 *  Sin imports de servidor a propósito — lo usan server components y
 *  componentes cliente por igual. */

export const ESTADOS_LEAD = [
  "nuevo",
  "contactado",
  "conversacion",
  "cliente",
  "descartado",
] as const;

export type EstadoLead = (typeof ESTADOS_LEAD)[number];

/** Un Record y no un switch: si la DB suma un estado, esto deja de compilar.
 *  `color` es el del embudo y la leyenda; `pill` el de la píldora en tablas. */
export const ESTADO_LEAD: Record<
  EstadoLead,
  { label: string; plural: string; pill: string; punto: string; color: string }
> = {
  nuevo: {
    label: "Nuevo",
    plural: "Nuevos",
    pill: "bg-infobg text-info",
    punto: "bg-info",
    color: "var(--info)",
  },
  contactado: {
    label: "Contactado",
    plural: "Contactados",
    pill: "bg-midbg text-mid",
    punto: "bg-mid",
    color: "var(--mid)",
  },
  conversacion: {
    label: "En conversación",
    plural: "En conversación",
    pill: "bg-[#f3e9fb] text-magenta",
    punto: "bg-magenta",
    color: "var(--magenta)",
  },
  cliente: {
    label: "Cliente",
    plural: "Clientes",
    pill: "bg-okbg text-ok",
    punto: "bg-ok",
    color: "var(--ok)",
  },
  descartado: {
    label: "Descartado",
    plural: "Descartados",
    pill: "bg-bg text-tinta2",
    punto: "bg-tinta2",
    color: "var(--tinta2)",
  },
};

export function esEstadoLead(valor: string | undefined): valor is EstadoLead {
  return !!valor && (ESTADOS_LEAD as readonly string[]).includes(valor);
}

/** Estado del análisis (columna `status`). Es info de pipeline, no de venta:
 *  se muestra tenue para no competir con el estado del lead. */
export const ESTADO_ANALISIS: Record<string, { label: string; clase: string }> = {
  pending: { label: "En cola", clase: "bg-bg text-tinta2" },
  analyzing: { label: "Analizando", clase: "bg-infobg text-info" },
  preliminary: { label: "Preliminar", clase: "bg-midbg text-mid" },
  sent: { label: "Enviado", clase: "bg-okbg text-ok" },
  failed: { label: "Falló", clase: "bg-warnbg text-warn" },
};

/** Los cortes son los de AGENTS.md (0-39 / 40-64 / 65+). Devuelve el color
 *  como var() porque se usa inline sobre el número del score. */
export function colorScore(score: number): string {
  if (score < 40) return "var(--warn)";
  if (score < 65) return "var(--mid)";
  return "var(--ok)";
}

/** "Hoy" / "Ayer" / "Hace 3 días" / fecha corta, como en el mockup. */
export function fechaRelativa(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";

  const hoy = new Date();
  const dias = Math.floor(
    (Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) -
      Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())) /
      86_400_000,
  );

  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 14) return "Hace 1 semana";
  if (dias < 31) return `Hace ${Math.floor(dias / 7)} semanas`;
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

/** Iniciales para el avatar de la empresa. Máximo 2 letras. */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

const GRADIENTES = [
  "linear-gradient(135deg,#FE6F61,#B50CC5)",
  "linear-gradient(135deg,#B50CC5,#252851)",
  "linear-gradient(135deg,#FE6F61,#252851)",
  "linear-gradient(135deg,#B50CC5,#FE6F61)",
];

/** Determinista sobre el nombre: la misma empresa mantiene su color entre
 *  vistas y entre renders del servidor. */
export function gradienteAvatar(nombre: string): string {
  let suma = 0;
  for (let i = 0; i < nombre.length; i++) suma += nombre.charCodeAt(i);
  return GRADIENTES[suma % GRADIENTES.length];
}

/** Los canales con madurez medible, en el mismo orden que el informe.
 *
 *  Duplica a propósito la lista de `lib/analysis/schema.ts` en vez de
 *  importarla: este módulo lo usan componentes cliente, e importar el schema
 *  arrastraría zod al bundle del browser. Si se agrega un canal, se agrega en
 *  los dos lados. */
export const CANALES_MADUREZ = [
  { id: "sitio", label: "Sitio web" },
  { id: "contacto", label: "Vías de contacto" },
  { id: "orden", label: "Orden del sitio" },
  { id: "busqueda", label: "Qué ve Google" },
  { id: "medicion", label: "Medición" },
] as const;

export type CanalMadurez = (typeof CANALES_MADUREZ)[number]["id"];
