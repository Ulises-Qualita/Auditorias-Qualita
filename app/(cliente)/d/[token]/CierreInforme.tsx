import Image from "next/image";

import type { Fuga } from "@/lib/diagnostico/results";

import { WHATSAPP_QUALITA } from "../../_components/contacto";

/** Cierre del informe: puntos de fuga, lo que queda a validar, el CTA gateado
 *  y el footer. Todo estático, así que va en servidor. */

export function Fugas({ fugas }: { fugas: Fuga[] }) {
  if (fugas.length === 0) return null;

  return (
    <section className="border-b border-linea px-[clamp(18px,5vw,32px)] py-[clamp(38px,6vw,54px)]">
      <div className="mx-auto w-full max-w-[940px]">
        <Kicker>Dónde estás perdiendo consultas</Kicker>
        <h2 className="mt-3 text-[clamp(1.25rem,2.6vw,1.5rem)] font-semibold text-navy">
          {fugas.length === 1
            ? "El punto de fuga más urgente"
            : `Los ${fugas.length} puntos de fuga más urgentes`}
        </h2>
        <p className="mt-2 max-w-[54ch] text-[0.94rem] text-tinta">
          Lo que hoy corta el camino entre alguien interesado y una consulta tuya.
        </p>

        {/* Cada tarjeta es el título arriba y el bloque oscuro abajo, como la
            lámina del ejemplo. `items-stretch` + `flex-1` en la cabecera
            mantienen los bloques oscuros alineados entre sí aunque los títulos
            tengan distinto largo. */}
        <div className="mt-7 grid items-stretch gap-4 md:grid-cols-3">
          {fugas.map((fuga, i) => (
            <article
              key={`${fuga.titulo}-${i}`}
              className="flex min-w-0 flex-col overflow-hidden rounded-card border border-linea bg-white shadow-qualita"
            >
              <div className="flex flex-1 flex-col p-5">
                <span
                  aria-hidden="true"
                  className="font-display text-[0.95rem] leading-none font-bold text-coral"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-[1.02rem] leading-[1.3] font-semibold text-balance text-navy">
                  {fuga.titulo}
                </h3>
              </div>

              <div className="bg-navy px-5 py-4 text-[0.84rem] leading-[1.5] text-white/85">
                <b className="mb-1.5 block text-[0.64rem] font-bold tracking-[0.14em] text-coral uppercase">
                  Qué se pierde
                </b>
                {fuga.que_se_pierde}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** La honestidad del método hecha sección: lo que NO pudimos verificar se
 *  dice, no se tapa. */
export function AValidar({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="border-b border-linea bg-crema px-[clamp(18px,5vw,32px)] py-[46px]">
      <div className="mx-auto w-full max-w-[940px]">
        <Kicker>Lo que todavía no podemos afirmar</Kicker>
        <h2 className="mt-3 text-[1.35rem] font-semibold">
          Lo que confirmamos con el análisis completo
        </h2>
        <p className="mt-1.5 max-w-[52ch] text-tinta">
          Este informe se arma con lo que se puede verificar desde afuera. Esto es
          lo que queda pendiente: preferimos decirlo antes que estimarlo.
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-white text-[0.8rem] font-bold text-tinta shadow-qualita"
              >
                ?
              </span>
              <span className="text-[0.9rem] text-navy">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function CtaQualita({ cantidadFugas }: { cantidadFugas: number }) {
  return (
    // Sigue al mazo sobre el mismo gris y con su mismo margen lateral, así el
    // bloque queda alineado con el borde de las láminas.
    <section className="bg-[#e7e7ee] px-[clamp(10px,3vw,32px)] pb-[clamp(28px,5vw,56px)]">
      <div className="mx-auto w-full max-w-(--ancho-informe)">
        <div
          className="relative overflow-hidden rounded-[22px] p-[clamp(28px,4.4vw,58px)] text-white"
          style={{ background: "var(--grad-mv)" }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-10 h-[280px] w-[280px] rounded-full opacity-50 blur-[90px]"
            style={{ background: "radial-gradient(circle, var(--coral), transparent 70%)" }}
          />

          <div className="relative z-10">
            <span aria-hidden="true" className="font-display text-[1.8rem] leading-[0.7] font-bold">
              *
            </span>
            <h2 className="mt-3 max-w-[22ch] text-[clamp(1.4rem,3.2vw,2.1rem)] font-bold text-white">
              {cantidadFugas > 0
                ? cantidadFugas === 1
                  ? "Encontramos un punto de fuga. Te mostramos cómo se resuelve."
                  : `Encontramos ${cantidadFugas} puntos de fuga. Te mostramos cómo se resuelven.`
                : "Te mostramos cómo se resuelve, paso por paso."}
            </h2>
            <p className="mt-3 max-w-[50ch] text-white/80">
              El plan de acción con prioridades, plazos y presupuesto lo armamos juntos
              en una llamada de 30 minutos. Sin compromiso.
            </p>

            <a
              href={WHATSAPP_QUALITA}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[0.92rem] font-bold text-navy transition-transform hover:-translate-y-px"
            >
              Hablar con Qualita por WhatsApp →
            </a>

            <p className="mt-[18px] flex items-center gap-2 text-[0.85rem] text-white/70">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4 flex-none"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="3" y="7" width="10" height="6.5" rx="1.6" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
              </svg>
              El plan de acción completo se comparte en la llamada.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** `method_version` no va acá: es metadato interno para la consola, no algo
 *  que le diga nada al cliente. */
export function PieInforme({ fecha }: { fecha: string }) {
  return (
    <>
      <p className="mx-auto max-w-(--ancho-informe) px-[clamp(18px,5vw,32px)] py-7 text-center text-[0.83rem] text-tinta">
        Método: chequeos automáticos sobre tu sitio (contenido, SEO on-page, etiquetas
        de medición y DMARC) e interpretación por el equipo de Qualita. Fuentes
        públicas verificadas{fecha && ` · ${fecha}`}.
      </p>

      <footer className="bg-dark px-[clamp(18px,5vw,32px)] py-10 text-white">
        <div className="mx-auto flex w-full max-w-(--ancho-informe) flex-wrap items-center justify-between gap-4">
          <Image
            src="/qualita-logo-blanco.svg"
            alt="Qualita Studio"
            width={277}
            height={114}
            className="h-10 w-auto"
          />
          <div className="flex gap-[22px] text-[0.88rem] text-white/60">
            <a href="https://qualita.studio" className="hover:text-white">
              qualita.studio
            </a>
            <a href="mailto:hola@qualita.studio" className="hover:text-white">
              hola@qualita.studio
            </a>
          </div>
        </div>
      </footer>
    </>
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
