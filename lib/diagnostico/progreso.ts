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
 *  Duraciones: PageSpeed con las 4 categorías tarda ~50 s y corre primero, en
 *  su propio step; la recolección del HTML es casi instantánea y la
 *  interpretación con Claude ~90 s. Total estimado ~2 minutos y medio.
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

/** En el orden del pipeline: PageSpeed (su propio step), la recolección
 *  determinista del HTML (collect.ts) y después la interpretación con Claude. Solo nombra lo que de verdad se revisa; los
 *  canales que el informe omite (posiciones, Ads, redes, competencia) no van. */
export const PASOS_ANALISIS: PasoAnalisis[] = [
  {
    titulo: "Midiendo la velocidad de carga",
    detalle: "Cuánto tarda en abrir tu sitio desde un celular, con la herramienta de Google.",
    interno: "PageSpeed (4 categorías)",
    segundos: 30,
  },
  {
    titulo: "Entrando a tu sitio web",
    detalle: "Abrimos tu home tal como la ve alguien que llega por primera vez.",
    interno: "Descarga de la home",
    segundos: 4,
  },
  {
    titulo: "Buscando cómo te pueden contactar",
    detalle: "Teléfono, WhatsApp, mail y formularios: lo que se encuentra sin buscar.",
    interno: "Vías de contacto",
    segundos: 4,
  },
  {
    titulo: "Mirando cómo está ordenado el sitio",
    detalle: "Las secciones, los links internos y el camino hasta contactarte.",
    interno: "Arquitectura y links internos",
    segundos: 4,
  },
  {
    titulo: "Leyendo lo que ve Google",
    detalle: "Títulos, descripciones y encabezados de tu sitio.",
    interno: "SEO on-page",
    segundos: 4,
  },
  {
    titulo: "Chequeando tu medición",
    detalle: "Analítica, Tag Manager, píxeles y la configuración de tu mail.",
    interno: "Medición (GA4, GTM, píxel) y DMARC",
    segundos: 6,
  },
  {
    titulo: "Interpretando lo que encontramos",
    detalle: "Cruzamos los hallazgos para ver dónde se te pueden escapar consultas.",
    interno: "Interpretación con Claude",
    segundos: 65,
  },
  {
    titulo: "Armando tu informe",
    detalle: "Ordenando todo canal por canal, con la evidencia de cada punto.",
    interno: "Validación, score y guardado",
    segundos: 25,
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

  // Lineal hasta el 92% en el tiempo estimado; pasado eso se arrastra hacia
  // el 97% sin llegar nunca: el 100% es exclusivo de la confirmación real.
  const porcentaje = pasado
    ? 92 + 5 * (1 - Math.exp(-(segundos - TOTAL_ANALISIS_S) / 45))
    : 4 + (segundos / TOTAL_ANALISIS_S) * 88;

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
