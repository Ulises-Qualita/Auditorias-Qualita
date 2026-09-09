"use client";

import { useId, useState } from "react";

import {
  ETIQUETA_ESTADO,
  nivelDeScore,
  type CanalAValidar,
  type CanalInfra,
  type Check,
  type DiagnosticResults,
} from "@/lib/diagnostico/results";

type Props = {
  infra: DiagnosticResults["infra"];
  scoreInfra: number | null;
};

/** Las 5 verticales, en el orden del mockup. El `key` tiene que coincidir con
 *  la forma de `results.infra`, así que si el esquema cambia esto no compila. */
const VERTICALES = [
  { key: "sitio", label: "Sitio web", titulo: "Sitio web", desc: "El recorrido del comprador más los chequeos técnicos." },
  { key: "seo", label: "SEO", titulo: "SEO / Google orgánico", desc: "Cómo aparecés cuando buscan lo que vendés." },
  { key: "google_ads", label: "Google Ads", titulo: "Google Ads", desc: "Presencia en las búsquedas de alta intención." },
  { key: "meta_ads", label: "Meta Ads", titulo: "Meta Ads", desc: "Biblioteca de anuncios de Meta." },
  { key: "medicion", label: "Medición", titulo: "Medición / tracking", desc: "Etiquetas detectadas en el sitio." },
] as const satisfies ReadonlyArray<{
  key: keyof DiagnosticResults["infra"];
  label: string;
  titulo: string;
  desc: string;
}>;

/** Los 2 pilares. Arranca en Infraestructura y no en Marca (como el mockup)
 *  porque en v1 Marca no tiene datos: abrir en el panel vacío sería una mala
 *  primera pantalla. */
export function Pilares({ infra, scoreInfra }: Props) {
  const [pilar, setPilar] = useState<"marca" | "infra">("infra");
  const idBase = useId();

  return (
    <section className="border-b border-linea px-[clamp(18px,5vw,32px)] py-[46px]">
      <div className="mx-auto w-full max-w-[940px]">
        <Kicker>Tu diagnóstico en dos pilares</Kicker>
        <h2 className="mt-3 text-[1.35rem] font-semibold">Marca e Infraestructura</h2>
        <p className="mt-1.5 max-w-[52ch] text-tinta">
          Tu presencia se evalúa en dos frentes. Tocá cada uno para ver su detalle.
        </p>

        <div role="tablist" aria-label="Pilares del diagnóstico" className="my-6 grid gap-3 sm:grid-cols-2">
          <BigTab
            id={`${idBase}-marca`}
            panelId={`${idBase}-marca-panel`}
            activo={pilar === "marca"}
            onClick={() => setPilar("marca")}
            numero="1"
            titulo="Marca implementadora"
            bajada="Branding · redes · reputación"
            score={null}
            acento="marca"
          />
          <BigTab
            id={`${idBase}-infra`}
            panelId={`${idBase}-infra-panel`}
            activo={pilar === "infra"}
            onClick={() => setPilar("infra")}
            numero="2"
            titulo="Infraestructura digital"
            bajada="Sitio · SEO · anuncios · medición"
            score={scoreInfra}
            acento="infra"
          />
        </div>

        {pilar === "marca" ? (
          <div id={`${idBase}-marca-panel`} role="tabpanel" aria-labelledby={`${idBase}-marca`}>
            <PanelMarca />
          </div>
        ) : (
          <div id={`${idBase}-infra-panel`} role="tabpanel" aria-labelledby={`${idBase}-infra`}>
            <PanelInfra infra={infra} scoreInfra={scoreInfra} />
          </div>
        )}
      </div>
    </section>
  );
}

function BigTab({
  id,
  panelId,
  activo,
  onClick,
  numero,
  titulo,
  bajada,
  score,
  acento,
}: {
  id: string;
  panelId: string;
  activo: boolean;
  onClick: () => void;
  numero: string;
  titulo: string;
  bajada: string;
  score: number | null;
  acento: "marca" | "infra";
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={activo}
      aria-controls={panelId}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3.5 rounded-[16px] border-[1.5px] p-[18px_20px] text-left shadow-qualita transition-colors ${
        activo
          ? "border-transparent bg-navy text-white"
          : "border-linea bg-white hover:border-tinta2"
      }`}
    >
      <span
        aria-hidden="true"
        className={`font-display flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] text-[1rem] font-bold ${
          activo ? "text-white" : "bg-bg text-tinta"
        }`}
        style={activo ? { background: "var(--grad)" } : undefined}
      >
        {numero}
      </span>

      <span className="min-w-0 flex-1">
        <b className="font-display block text-[1.05rem] font-semibold">{titulo}</b>
        <small className={`mt-[3px] block text-[0.8rem] ${activo ? "text-white/70" : "text-tinta"}`}>
          {bajada}
        </small>
      </span>

      <span
        className={`flex h-[54px] min-w-[54px] flex-none flex-col items-center justify-center rounded-[14px] leading-none ${
          activo
            ? "bg-white/15 text-white"
            : acento === "marca"
              ? "bg-magenta/10 text-magenta"
              : "bg-coral/10 text-coral"
        }`}
      >
        {score === null ? (
          <i className="px-2 text-[0.58rem] font-semibold not-italic opacity-80">A validar</i>
        ) : (
          <>
            <b className="font-display text-[1.18rem] font-bold">{score}</b>
            <i className="mt-0.5 text-[0.58rem] not-italic opacity-70">/100</i>
          </>
        )}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ pilar 1 */

/** v1 no evalúa Marca. Estado vacío con lo que sí podemos decir: qué incluye
 *  el pilar y dónde se evalúa. Nada de tarjetas en blanco. */
function PanelMarca() {
  const incluye = [
    { t: "Identidad y branding", d: "Si tu identidad es consistente y si la trayectoria se ve online." },
    { t: "Redes sociales", d: "Calidad del contenido, frecuencia y si invita a consultar." },
    { t: "Reputación", d: "Ficha de Google, reseñas y cómo te ve quien todavía no te conoce." },
  ];

  return (
    <div className="rounded-[16px] border border-linea bg-white p-[clamp(24px,4vw,40px)] shadow-qualita">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="font-display flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px] text-[1.15rem] font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--magenta), #7a2bd0)" }}
        >
          1
        </span>
        <div>
          <span className="inline-block rounded-full bg-infobg px-[11px] py-1 text-[0.68rem] font-bold tracking-[0.08em] text-info uppercase">
            A validar
          </span>
          <h3 className="mt-2 text-[1.22rem]">
            Este pilar se evalúa en el análisis completo con Qualita
          </h3>
          <p className="mt-2 max-w-[54ch] text-[0.92rem] text-tinta">
            La marca no se puede leer entera desde el código de un sitio: hace falta
            mirar tus redes, tu ficha de Google y tu reputación con ojo humano. Lo
            hacemos en el diagnóstico completo, y por eso acá no ponemos un número.
          </p>
        </div>
      </div>

      <ul className="mt-7 grid gap-4 border-t border-linea2 pt-6 sm:grid-cols-3">
        {incluye.map((item) => (
          <li key={item.t}>
            <h4 className="font-sans text-[0.95rem] font-bold">{item.t}</h4>
            <p className="mt-1.5 text-[0.88rem] text-tinta">{item.d}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ pilar 2 */

function PanelInfra({ infra, scoreInfra }: Props) {
  const [vertical, setVertical] = useState<keyof DiagnosticResults["infra"]>("sitio");
  const activa = VERTICALES.find((v) => v.key === vertical) ?? VERTICALES[0];
  const canal = infra[activa.key];

  return (
    <>
      <AnilloInfra score={scoreInfra} />

      <p className="mt-6 mb-2 text-tinta">El detalle, vertical por vertical:</p>

      <div role="tablist" aria-label="Verticales de infraestructura" className="flex flex-wrap gap-2">
        {VERTICALES.map((v) => {
          const activo = v.key === vertical;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setVertical(v.key)}
              className={`rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition-colors ${
                activo
                  ? "border-navy bg-navy text-white"
                  : "border-linea bg-white text-tinta hover:border-tinta2"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-[16px] border border-linea bg-white p-[clamp(20px,3vw,28px)] shadow-qualita">
        <h3 className="text-[1.1rem]">{activa.titulo}</h3>
        <p className="mt-1 text-[0.9rem] text-tinta">{activa.desc}</p>

        {esCanalAValidar(canal) ? (
          <CanalPendiente canal={canal} />
        ) : (
          <CanalCompleto canal={canal} />
        )}
      </div>
    </>
  );
}

/** Discriminación por forma: el canal a validar no trae `madurez` ni `checks`. */
function esCanalAValidar(canal: CanalInfra | CanalAValidar): canal is CanalAValidar {
  return !("madurez" in canal);
}

function CanalCompleto({ canal }: { canal: CanalInfra }) {
  const estado = ETIQUETA_ESTADO[canal.estado];

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-linea2 pt-4">
        <span className={`rounded-full px-[11px] py-[5px] text-[0.72rem] font-bold ${estado.clase}`}>
          {estado.label}
        </span>
        <Dots valor={canal.madurez} />
      </div>

      <p className="mt-3 text-[0.95rem]">{canal.insight}</p>

      {canal.checks.length > 0 && (
        <ul className="mt-5 border-t border-linea2">
          {canal.checks.map((check, i) => (
            <li key={`${check.titulo}-${i}`} className="flex gap-3.5 border-b border-linea2 py-3.5">
              <IconoCheck tipo={check.tipo} />
              <div>
                <div className="text-[0.92rem] font-semibold">{check.titulo}</div>
                {check.detalle && (
                  <div className="mt-1 text-[0.88rem] text-tinta">{check.detalle}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Google Ads y Meta Ads en v1: el insight, y nada de dots ni checks. Poner
 *  una madurez inventada sería exactamente lo que el método prohíbe. */
function CanalPendiente({ canal }: { canal: CanalAValidar }) {
  const estado = ETIQUETA_ESTADO[canal.estado];

  return (
    <>
      <div className="mt-4 border-t border-linea2 pt-4">
        <span className={`rounded-full px-[11px] py-[5px] text-[0.72rem] font-bold ${estado.clase}`}>
          {estado.label}
        </span>
      </div>

      <p className="mt-3 text-[0.95rem]">{canal.insight}</p>

      <div className="mt-5 flex items-start gap-3 rounded-[12px] bg-crema px-4 py-3.5">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="mt-px h-[18px] w-[18px] flex-none text-coral"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 6.5v4" strokeLinecap="round" />
          <path d="M10 13.5h.01" strokeLinecap="round" />
        </svg>
        <p className="text-[0.88rem] text-navy">
          <b className="font-semibold">Se analiza en el diagnóstico completo.</b>{" "}
          Necesitamos acceso de solo lectura a la cuenta para no afirmar nada sin
          verificarlo.
        </p>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- primitivas */

function AnilloInfra({ score }: { score: number | null }) {
  const nivel = score === null ? null : nivelDeScore(score);
  const CIRCUNFERENCIA = 251.3;
  const offset = score === null ? CIRCUNFERENCIA : CIRCUNFERENCIA * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-6 rounded-[16px] border border-linea border-l-4 border-l-coral bg-white p-6 text-center shadow-qualita sm:flex-row sm:text-left">
      <div className="relative h-24 w-24 flex-none">
        <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
          <circle cx="48" cy="48" r="40" stroke="#eee" strokeWidth="9" fill="none" />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="var(--coral)"
            strokeWidth="9"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={offset}
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <b className="font-display text-[1.6rem] font-bold">{score ?? "—"}</b>
          <small className="mt-0.5 text-[0.6rem] text-tinta2">/100</small>
        </div>
      </div>

      <div>
        {nivel && (
          <span
            className={`inline-block rounded-full px-[11px] py-1 text-[0.68rem] font-bold tracking-[0.08em] uppercase ${nivel.clase}`}
          >
            {nivel.label}
          </span>
        )}
        <h3 className="mt-2 text-[1.22rem]">Infraestructura digital</h3>
        <p className="mt-1.5 max-w-[54ch] text-[0.92rem] text-tinta">
          Lo que hace que la consulta llegue o se pierda: sitio, SEO, anuncios y
          medición.
        </p>
      </div>
    </div>
  );
}

/** Madurez 1-5. Los puntos son decorativos: el valor va en texto para lectores
 *  de pantalla. */
function Dots({ valor }: { valor: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="sr-only">Madurez {valor} de 5</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${n <= valor ? "bg-navy" : "bg-linea"}`}
        />
      ))}
    </span>
  );
}

const ICONO: Record<Check["tipo"], { simbolo: string; clase: string; etiqueta: string }> = {
  error: { simbolo: "✕", clase: "bg-warnbg text-warn", etiqueta: "Problema" },
  alerta: { simbolo: "!", clase: "bg-midbg text-mid", etiqueta: "Atención" },
  ok: { simbolo: "✓", clase: "bg-okbg text-ok", etiqueta: "Bien" },
};

function IconoCheck({ tipo }: { tipo: Check["tipo"] }) {
  const icono = ICONO[tipo];
  return (
    <span
      className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-[0.8rem] font-bold ${icono.clase}`}
    >
      <span className="sr-only">{icono.etiqueta}: </span>
      <span aria-hidden="true">{icono.simbolo}</span>
    </span>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 text-[0.68rem] font-bold tracking-[0.2em] text-magenta uppercase">
      <span aria-hidden="true" className="h-px w-5 flex-none bg-coral" />
      {children}
    </span>
  );
}
