/** Estado terminal sin informe: la comparten `/d/[token]` (status 'failed' o
 *  results ilegible) y `/analizando/[id]` (el análisis falló, o el polling se
 *  agotó esperando). Mismo mensaje sobrio en los dos lados; el motivo técnico
 *  queda en la consola interna, no en la cara del cliente. */

import { WHATSAPP_QUALITA } from "./contacto";

type Props = {
  titulo?: string;
  children?: React.ReactNode;
  /** El CTA a Qualita no siempre corresponde: si el análisis sigue corriendo
   *  y solo está tardando, no hay nada que resolver con nosotros todavía. */
  conCta?: boolean;
};

export function PantallaSinInforme({
  titulo = "No pudimos completar tu diagnóstico",
  children,
  conCta = true,
}: Props) {
  return (
    <section className="flex flex-1 items-center px-[clamp(18px,5vw,32px)] py-24">
      <div className="mx-auto w-full max-w-[520px] text-center">
        <span aria-hidden="true" className="font-display text-[2rem] leading-[0.7] font-bold text-coral">
          *
        </span>
        <h1 className="mt-4 text-[1.6rem] font-bold">{titulo}</h1>
        <p className="mt-3 text-tinta">
          {children ?? (
            <>
              Algo se cortó mientras analizábamos tu presencia digital. Escribinos por WhatsApp y lo
              resolvemos con vos: no hace falta que cargues el formulario de nuevo.
            </>
          )}
        </p>
        {conCta && (
          <a
            href={WHATSAPP_QUALITA}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.92rem] font-bold text-white"
            style={{ background: "var(--grad)" }}
          >
            Escribirle a Qualita por WhatsApp →
          </a>
        )}
      </div>
    </section>
  );
}
