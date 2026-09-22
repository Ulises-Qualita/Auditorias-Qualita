import { useEffect, useRef, useState } from "react";

/** Avance ESTIMADO del análisis, para las pantallas de espera del cliente
 *  (_components/PantallaAnalizando) y de la consola (ProgresoAnalisis).
 *
 *  Qué es real y qué es estimado:
 *  - REAL: el estado. En 'pending' no corre el reloj; arranca con 'analyzing'
 *    (anclado al `transcurridoMs` que calcula /api/diagnostics/[id]/status, así
 *    recargar no reinicia el progreso). El 100% solo lo da la confirmación.
 *  - ESTIMADO: qué paso está corriendo. El pipeline no reporta avance fino, así
 *    que los pasos avanzan con las duraciones típicas de una corrida y el
 *    último queda abierto hasta que el status confirme.
 *
 *  Duraciones medidas en una corrida real con búsqueda (Sonnet 5, 2026-09-22,
 *  762 s de punta a punta, steps de Inngest): PageSpeed 42 s, facts 2 s, la
 *  primera llamada a Claude —la de las búsquedas— 101 s, lecturas y segunda
 *  llamada 90 s, y la última llamada, que razona y escribe el JSON entero,
 *  526 s. Si el pipeline cambia de duración, se recalibra ACÁ: con los pasos
 *  de ~2 minutos de antes la barra llegaba al 92% en dos minutos y quedaba
 *  diez clavada en 97%.
 *
 *  Solo lo importan componentes cliente (usa hooks). */

export type PasoAnalisis = {
  /** Para el cliente: en "vos", sin tecnicismos. */
  titulo: string;
  detalle: string;
  /** Para la consola: qué parte del pipeline es. */
  interno: string;
  segundos: number;
};

/** En el orden del pipeline (lib/inngest/functions.ts y analisisPorPasos.ts).
 *  La última llamada a Claude se parte en dos pasos porque son casi nueve
 *  minutos: un solo paso tanto tiempo parece colgado. */
export const PASOS_ANALISIS: PasoAnalisis[] = [
  {
    titulo: "Midiendo la velocidad de carga",
    detalle: "Cuánto tarda en abrir tu sitio desde un celular, con la herramienta de Google.",
    interno: "PageSpeed (4 categorías)",
    segundos: 42,
  },
  {
    titulo: "Revisando tu sitio web",
    detalle: "Tu home, las vías de contacto, lo que ve Google y la medición instalada.",
    interno: "Facts del sitio (collect + DMARC)",
    segundos: 3,
  },
  {
    titulo: "Buscándote en Google como lo haría un cliente",
    detalle: "Con las palabras que usa quien busca lo que vendés, y quiénes aparecen antes.",
    interno: "Búsqueda web: posiciones y competencia",
    segundos: 50,
  },
  {
    titulo: "Mirando tu ficha de Google, tus redes y tu pauta",
    detalle: "Lo que ve alguien que te busca por nombre, y si hay anuncios activos.",
    interno: "Búsqueda web: ficha, redes y pauta",
    segundos: 50,
  },
  {
    titulo: "Leyendo los sitios de tu competencia",
    detalle: "Cómo se presentan, cómo captan consultas y qué miden.",
    interno: "leer_pagina + segunda llamada",
    segundos: 90,
  },
  {
    titulo: "Cruzando todo lo que encontramos",
    detalle: "Tu sitio contra cómo busca el comprador y contra lo que hace tu sector.",
    interno: "Última llamada: razonamiento",
    segundos: 240,
  },
  {
    titulo: "Escribiendo tu informe",
    detalle: "Canal por canal, con la evidencia de cada punto y lo que queda a validar.",
    interno: "Última llamada: JSON, score y guardado",
    segundos: 290,
  },
];

export const TOTAL_ANALISIS_S = PASOS_ANALISIS.reduce((suma, paso) => suma + paso.segundos, 0);

/** Fin acumulado de cada paso, en segundos. */
const FINES = PASOS_ANALISIS.reduce<number[]>((acc, paso) => {
  acc.push((acc.at(-1) ?? 0) + paso.segundos);
  return acc;
}, []);

export type EstadoAnalisis = "pending" | "analyzing";

export type Progreso = {
  /** Índice del paso en curso: -1 en la fila, PASOS.length si terminó. */
  activo: number;
  /** 0-100. */
  porcentaje: number;
  enFila: boolean;
  /** Ya pasó el tiempo estimado y seguimos esperando la confirmación. */
  pasado: boolean;
};

export function calcularProgreso(
  status: EstadoAnalisis,
  segundos: number,
  listo: boolean,
): Progreso {
  if (listo) {
    return { activo: PASOS_ANALISIS.length, porcentaje: 100, enFila: false, pasado: false };
  }
  if (status === "pending") {
    return { activo: -1, porcentaje: 3, enFila: true, pasado: false };
  }

  // El último paso nunca se da por terminado sin confirmación del servidor.
  const enCurso = FINES.findIndex((fin) => segundos < fin);
  const pasado = enCurso === -1;

  // Lineal hasta el 95% en el tiempo típico. Pasado eso sigue moviéndose
  // hacia el 99% sin llegar nunca —el 100% es exclusivo de la confirmación
  // real—, con una constante larga: una corrida con más vueltas de búsqueda
  // puede tardar unos minutos más, y una barra quieta parece colgada.
  const porcentaje = pasado
    ? 95 + 4 * (1 - Math.exp(-(segundos - TOTAL_ANALISIS_S) / 240))
    : 4 + (segundos / TOTAL_ANALISIS_S) * 91;

  return {
    activo: pasado ? PASOS_ANALISIS.length - 1 : enCurso,
    porcentaje,
    enFila: false,
    pasado,
  };
}

/** Segundos que lleva el análisis en 'analyzing'. Se re-ancla cada vez que el
 *  servidor manda un `transcurridoMs` nuevo, pero nunca retrocede: un ajuste
 *  hacia atrás haría "desmarcar" pasos, que se ve peor que un leve desfasaje. */
export function useSegundosAnalizando(
  status: EstadoAnalisis,
  transcurridoMs: number | null,
  listo: boolean,
): number {
  const ancla = useRef<{ baseMs: number; desde: number } | null>(null);
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (status !== "analyzing") {
      ancla.current = null;
      return;
    }
    if (transcurridoMs !== null || !ancla.current) {
      ancla.current = { baseMs: transcurridoMs ?? 0, desde: Date.now() };
    }
  }, [status, transcurridoMs]);

  useEffect(() => {
    if (status !== "analyzing" || listo) return;

    function tick() {
      const a = ancla.current;
      if (!a) return;
      const actual = (a.baseMs + Date.now() - a.desde) / 1000;
      setSegundos((previo) => Math.max(previo, actual));
    }

    tick();
    const intervalo = setInterval(tick, 1000);
    return () => clearInterval(intervalo);
  }, [status, listo]);

  return segundos;
}

export function formatearTiempo(segundos: number): string {
  const total = Math.floor(segundos);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
