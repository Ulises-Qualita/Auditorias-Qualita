/** Los modelos de Claude que se pueden elegir en Configuración.
 *
 *  Sin imports de servidor: lo usan el selector (cliente), la server action
 *  (para validar) y el pipeline. Cada id tiene que estar también en PRECIOS
 *  (costo.ts); si no, el costo del análisis se registraría en $0. */

export type ModeloDisponible = {
  id: string;
  nombre: string;
  desc: string;
};

export const MODELOS: readonly ModeloDisponible[] = [
  {
    id: "claude-opus-5",
    nombre: "Claude Opus 5",
    desc: "El más capaz. Mejor criterio para leer los hechos y escribir los hallazgos.",
  },
  {
    id: "claude-sonnet-5",
    nombre: "Claude Sonnet 5",
    desc: "Buen equilibrio entre calidad y costo.",
  },
  {
    id: "claude-opus-4-8",
    nombre: "Claude Opus 4.8",
    desc: "Generación anterior de Opus, al mismo precio que Opus 5.",
  },
  {
    id: "claude-haiku-4-5",
    nombre: "Claude Haiku 4.5",
    desc: "El más barato y rápido, con menos profundidad en el análisis.",
  },
];

export function esModeloDisponible(id: string): boolean {
  return MODELOS.some((m) => m.id === id);
}
