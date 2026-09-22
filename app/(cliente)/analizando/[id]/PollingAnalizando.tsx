"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { EstadoAnalisis } from "@/lib/diagnostico/progreso";
import { PantallaAnalizando } from "../../_components/PantallaAnalizando";
import { PantallaSinInforme } from "../../_components/PantallaSinInforme";

/** Seguimiento en vivo del análisis. El submit responde apenas crea los
 *  registros y deja `runAnalysis` corriendo en background (after()), así que
 *  el estado real solo se sabe preguntando: /api/diagnostics/[id]/status. */

/** Cada 5 s: con una corrida de ~13 minutos, 3 s eran 260 consultas para
 *  enterarse de un solo cambio de estado. */
const INTERVALO_MS = 5000;
/** ~30 minutos. Tope duro para no dejar un intervalo vivo para siempre si el
 *  análisis quedó colgado sin marcar 'failed'.
 *
 *  Era 100 × 3 s (~5 min) y con la búsqueda web quedó muy corto: una corrida
 *  real tarda ~13 minutos (ver lib/diagnostico/progreso.ts), así que el
 *  cliente veía "está tardando más de lo normal" a mitad de un análisis sano.
 *  30 minutos cubren una corrida lenta con reintentos de Inngest. */
const MAX_INTENTOS = 360;

/** Pausa con todo en verde antes de ir al informe, para que el cierre se vea. */
const PAUSA_LISTO_MS = 900;

type Estado = "esperando" | "listo" | "fallido" | "demorado";

export function PollingAnalizando({
  id,
  tokenInicial,
}: {
  id: string;
  tokenInicial: string | null;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("esperando");
  const [status, setStatus] = useState<EstadoAnalisis>("pending");
  const [transcurridoMs, setTranscurridoMs] = useState<number | null>(null);

  // El token que sirve es el que devuelve el status; el de la query es el
  // fallback por si el share_token no se pudo crear en el submit.
  const tokenRef = useRef(tokenInicial);

  useEffect(() => {
    const controlador = new AbortController();
    let intervalo: ReturnType<typeof setInterval> | null = null;
    let intentos = 0;
    let terminado = false;
    let redireccion: ReturnType<typeof setTimeout> | null = null;

    function frenar() {
      if (intervalo !== null) {
        clearInterval(intervalo);
        intervalo = null;
      }
    }

    async function consultar() {
      if (terminado) return;

      if (intentos >= MAX_INTENTOS) {
        terminado = true;
        frenar();
        setEstado("demorado");
        return;
      }
      intentos += 1;

      let cuerpo: {
        status?: string;
        token?: string | null;
        transcurridoMs?: number | null;
      } | null = null;
      try {
        const respuesta = await fetch(`/api/diagnostics/${id}/status`, {
          cache: "no-store",
          signal: controlador.signal,
        });
        if (!respuesta.ok) return; // 404 o error transitorio: reintentamos
        cuerpo = await respuesta.json();
      } catch {
        // Corte de red o unmount: que siga el intervalo, no rompemos la pantalla.
        return;
      }

      if (terminado || !cuerpo) return;
      if (cuerpo.token) tokenRef.current = cuerpo.token;

      // 'sent' = revisado por un humano; 'preliminary' = listo pero sin revisar.
      // Los dos se muestran, el informe distingue uno de otro.
      if (cuerpo.status === "preliminary" || cuerpo.status === "sent") {
        terminado = true;
        frenar();
        if (tokenRef.current) {
          const destino = `/d/${tokenRef.current}`;
          setEstado("listo");
          // replace: volver atrás desde el informe no debe traerte acá de nuevo.
          redireccion = setTimeout(() => router.replace(destino), PAUSA_LISTO_MS);
        } else {
          setEstado("fallido");
        }
        return;
      }

      if (cuerpo.status === "failed") {
        terminado = true;
        frenar();
        setEstado("fallido");
        return;
      }

      if (cuerpo.status === "pending" || cuerpo.status === "analyzing") {
        setStatus(cuerpo.status);
        setTranscurridoMs(cuerpo.transcurridoMs ?? null);
      }
    }

    function arrancar() {
      if (terminado || intervalo !== null) return;
      intervalo = setInterval(consultar, INTERVALO_MS);
    }

    // Con la pestaña oculta no hay a quién redirigir: pausamos y retomamos
    // con una consulta inmediata cuando vuelve.
    function alCambiarVisibilidad() {
      if (document.hidden) {
        frenar();
      } else {
        void consultar();
        arrancar();
      }
    }

    void consultar();
    arrancar();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      terminado = true;
      frenar();
      if (redireccion !== null) clearTimeout(redireccion);
      controlador.abort();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [id, router]);

  if (estado === "fallido") {
    return <PantallaSinInforme />;
  }

  if (estado === "demorado") {
    return (
      <PantallaSinInforme titulo="Está tardando más de lo normal" conCta={false}>
        Tu diagnóstico sigue en proceso. Podés cerrar esta pestaña: te avisamos por
        mail apenas esté listo.
      </PantallaSinInforme>
    );
  }

  return (
    <PantallaAnalizando
      status={status}
      transcurridoMs={transcurridoMs}
      listo={estado === "listo"}
    />
  );
}
