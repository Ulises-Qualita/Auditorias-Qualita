"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Caret from "./Caret";
import ComboLocalidad from "./ComboLocalidad";
import { RUBROS, TIPOS_CLIENTE } from "@/lib/diagnostico/opciones";
import {
  armarPayload,
  normalizarWebsite,
  pasoCompleto,
  primerPasoConError,
  requeridosCompletos,
  validarFormulario,
  validarPaso,
  type CamposFormulario,
  type ErroresFormulario,
  type Paso,
} from "@/lib/diagnostico/validacion";

/** Todo vacío: ningún campo es opcional, así que un valor precargado sería
 *  una trampa (se envía sin que nadie lo haya elegido). */
const CAMPOS_INICIALES: CamposFormulario = {
  name: "",
  website: "",
  industry: "",
  localidad: "",
  client_type: "",
  contact_name: "",
  contact_email: "",
};

/** Error global del envío. `duplicado` se muestra distinto: no es un fallo,
 *  es que ese email ya tiene su diagnóstico. */
type ErrorEnvio = { tipo: "duplicado" | "generico"; mensaje: string } | null;

const TITULOS: Record<Paso, { titulo: string; bajada: string }> = {
  1: {
    titulo: "Empecemos por tu empresa",
    bajada:
      "Con esto entendemos a qué te dedicás y a quién le vendés. Te lleva menos de dos minutos.",
  },
  2: {
    titulo: "¿Cómo te contactamos?",
    bajada: "Te avisamos por mail apenas esté listo tu diagnóstico.",
  },
};

export default function FormDiagnostico() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(1);
  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_INICIALES);
  const [errores, setErrores] = useState<ErroresFormulario>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<ErrorEnvio>(null);
  // Campo trampa: invisible para humanos, tentador para un bot que autocompleta
  // todo lo que parezca un input. Si viene con algo, el endpoint descarta.
  const [honeypot, setHoneypot] = useState("");

  const puedeAvanzar = useMemo(() => pasoCompleto(1, campos), [campos]);
  const puedeEnviar = useMemo(
    () => requeridosCompletos(campos) && !enviando,
    [campos, enviando],
  );

  function actualizar<K extends keyof CamposFormulario>(campo: K, valor: string) {
    setCampos((previo) => ({ ...previo, [campo]: valor }));
    // Limpiamos el error del campo apenas lo tocan; se revalida en blur.
    setErrores((previo) => {
      if (!previo[campo]) return previo;
      const siguiente = { ...previo };
      delete siguiente[campo];
      return siguiente;
    });
  }

  /** `valorNuevo` es para los controles que avisan al confirmar en vez de al
   *  tipear (el combo de localidad): ahí el `setCampos` todavía no se aplicó y
   *  validar contra `campos` daría el valor anterior. */
  function validarCampo(campo: keyof CamposFormulario, valorNuevo?: string) {
    const todos = validarFormulario(
      valorNuevo === undefined ? campos : { ...campos, [campo]: valorNuevo },
    );
    setErrores((previo) => {
      const siguiente = { ...previo };
      if (todos[campo]) siguiente[campo] = todos[campo];
      else delete siguiente[campo];
      return siguiente;
    });
  }

  /** Cambiar de paso no toca `campos`: lo cargado se conserva al ir y volver. */
  function irAPaso(destino: Paso) {
    setPaso(destino);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function siguiente() {
    const encontrados = validarPaso(1, campos);
    if (Object.keys(encontrados).length > 0) {
      setErrores((previo) => ({ ...previo, ...encontrados }));
      return;
    }
    irAPaso(2);
  }

  async function enviar() {
    setErrorEnvio(null);

    const encontrados = validarFormulario(campos);
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      // Si lo que falla quedó atrás, volvemos ahí para que lo pueda corregir.
      const pasoConError = primerPasoConError(encontrados);
      if (pasoConError && pasoConError !== paso) irAPaso(pasoConError);
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch("/api/diagnostics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(armarPayload(campos, honeypot)),
      });

      // El endpoint siempre responde JSON, pero un 500 de infra podría no hacerlo.
      const cuerpo = await respuesta.json().catch(() => null);

      if (respuesta.status === 201 && cuerpo?.diagnosticId) {
        const destino = cuerpo.token
          ? `/analizando/${cuerpo.diagnosticId}?t=${cuerpo.token}`
          : `/analizando/${cuerpo.diagnosticId}`;
        router.push(destino);
        return; // dejamos `enviando` en true: la navegación ya está en curso
      }

      if (respuesta.status === 409) {
        setErrorEnvio({
          tipo: "duplicado",
          mensaje: cuerpo?.error ?? "Este email ya generó un diagnóstico.",
        });
      } else if (respuesta.status === 400) {
        setErrorEnvio({
          tipo: "generico",
          mensaje: cuerpo?.error ?? "Revisá los datos e intentá de nuevo.",
        });
      } else {
        setErrorEnvio({
          tipo: "generico",
          mensaje:
            "No pudimos generar tu diagnóstico. Probá de nuevo en un momento.",
        });
      }
    } catch {
      setErrorEnvio({
        tipo: "generico",
        mensaje: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
      });
    }
    setEnviando(false);
  }

  /** Un solo submit para los dos pasos: así Enter en un input del paso 1
   *  avanza en vez de disparar el POST con la mitad de los datos. */
  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (paso === 1) siguiente();
    else void enviar();
  }

  const { titulo, bajada } = TITULOS[paso];

  return (
    <div className="mx-auto w-full max-w-[600px] px-[clamp(18px,5vw,32px)] pt-12 pb-28">
      <Kicker>Paso {paso} de 2</Kicker>

      <Progreso paso={paso} />

      <h1 className="mt-1 font-display text-[1.55rem] font-semibold text-navy">
        {titulo}
      </h1>
      <p className="mt-2 text-tinta">{bajada}</p>

      <form onSubmit={alEnviar} noValidate className="mt-8">
        {paso === 1 ? (
          <>
            <Campo
              id="name"
              label="Nombre de tu empresa"
              placeholder="Ej. Constructora del Sur S.A."
              valor={campos.name}
              error={errores.name}
              onChange={(v) => actualizar("name", v)}
              onBlur={() => validarCampo("name")}
              autoComplete="organization"
            />

            <Campo
              id="website"
              label="Sitio web"
              hint="es lo que vamos a analizar"
              placeholder="https://tuempresa.com"
              valor={campos.website}
              error={errores.website}
              onChange={(v) => actualizar("website", v)}
              onBlur={() => {
                // Le completamos el https:// para que vea lo que vamos a analizar.
                const normalizado = normalizarWebsite(campos.website);
                if (normalizado !== campos.website) {
                  setCampos((previo) => ({ ...previo, website: normalizado }));
                }
                validarCampo("website");
              }}
              inputMode="url"
              autoComplete="url"
            />

            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              <CampoSelect
                id="industry"
                label="Rubro"
                valor={campos.industry}
                error={errores.industry}
                onChange={(v) => actualizar("industry", v)}
                onBlur={() => validarCampo("industry")}
              >
                <option value="">Seleccioná…</option>
                {RUBROS.map((rubro) => (
                  <option key={rubro} value={rubro}>
                    {rubro}
                  </option>
                ))}
              </CampoSelect>

              <ComboLocalidad
                id="localidad"
                valor={campos.localidad}
                error={errores.localidad}
                onChange={(v) => actualizar("localidad", v)}
                onCerrar={(v) => validarCampo("localidad", v)}
              />
            </div>

            <fieldset className="mb-5">
              <legend className="mb-2 block text-[0.9rem] font-semibold text-navy">
                ¿A quién le vendés?
              </legend>
              <div
                className="flex flex-wrap gap-2.5"
                aria-describedby={errores.client_type ? "client_type-error" : undefined}
              >
                {TIPOS_CLIENTE.map((tipo) => {
                  const activo = campos.client_type === tipo.value;
                  return (
                    <label
                      key={tipo.value}
                      className={`cursor-pointer rounded-full border-[1.5px] px-[18px] py-2.5 text-[0.9rem] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-magenta/40 ${
                        activo
                          ? "border-transparent bg-[image:var(--grad)] text-white"
                          : errores.client_type
                            ? "border-warn text-navy"
                            : "border-linea text-navy hover:border-tinta2"
                      }`}
                    >
                      <input
                        type="radio"
                        name="client_type"
                        value={tipo.value}
                        checked={activo}
                        onChange={() => actualizar("client_type", tipo.value)}
                        className="sr-only"
                      />
                      {tipo.label}
                    </label>
                  );
                })}
              </div>
              {errores.client_type && (
                <p id="client_type-error" className="mt-1.5 text-[0.82rem] text-warn">
                  {errores.client_type}
                </p>
              )}
            </fieldset>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={!puedeAvanzar}
                className="inline-flex items-center justify-center gap-2 rounded-[11px] bg-[image:var(--grad)] px-[26px] py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_6px_18px_rgba(181,12,197,.28)] transition hover:not-disabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                Siguiente <Flecha />
              </button>
            </div>
          </>
        ) : (
          <>
            <Campo
              id="contact_name"
              label="Tu nombre"
              placeholder="Nombre y apellido"
              valor={campos.contact_name}
              error={errores.contact_name}
              onChange={(v) => actualizar("contact_name", v)}
              onBlur={() => validarCampo("contact_name")}
              autoComplete="name"
            />
            <Campo
              id="contact_email"
              label="Email"
              hint="te avisamos acá"
              placeholder="vos@tuempresa.com"
              valor={campos.contact_email}
              error={errores.contact_email}
              onChange={(v) => actualizar("contact_email", v)}
              onBlur={() => validarCampo("contact_email")}
              type="email"
              inputMode="email"
              autoComplete="email"
            />

            <Honeypot valor={honeypot} onChange={setHoneypot} />

            {errorEnvio && <AvisoError error={errorEnvio} />}

            <AvisoPrivacidad />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => irAPaso(1)}
                disabled={enviando}
                className="inline-flex items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-linea bg-white px-[18px] py-3.5 text-[0.95rem] font-semibold text-navy transition hover:not-disabled:border-tinta2 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Flecha atras /> Volver
              </button>
              <button
                type="submit"
                disabled={!puedeEnviar}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-[11px] bg-[image:var(--grad)] px-[18px] py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_6px_18px_rgba(181,12,197,.28)] transition hover:not-disabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                {enviando ? (
                  <>
                    <Spinner />
                    Generando tu diagnóstico…
                  </>
                ) : (
                  <>
                    Generar mi diagnóstico{" "}
                    <span className="font-display leading-none">✳</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}

        <p className="mt-5 flex items-center gap-2 text-[0.82rem] text-tinta2">
          <Candado />
          Usamos solo información pública. No pedimos accesos ni contraseñas.
        </p>
      </form>
    </div>
  );
}

/* ---------- piezas de UI ---------- */

/** Aviso de privacidad (Ley 25.326, art. 6: informar para qué se piden los
 *  datos, quién los guarda y cómo ejercer los derechos). Va justo antes del
 *  envío, que es cuando se entregan el nombre y el email.
 *
 *  Todo lo que dice tiene que seguir siendo cierto: a Claude le llegan los
 *  datos de la EMPRESA y los hechos del sitio (lib/analysis/prompt.ts), nunca
 *  el nombre ni el email del contacto; el email solo sale hacia el proveedor
 *  de mails para mandar el informe. Si eso cambia, este texto cambia. */
function AvisoPrivacidad() {
  return (
    <div className="mt-6 text-[0.8rem] leading-relaxed text-tinta2">
      <p>
        Al generar el diagnóstico aceptás que Qualita Studio use tu nombre y tu email para
        mandarte el informe y contactarte sobre él. No los compartimos con terceros para otros
        fines.
      </p>
      <details className="group mt-1.5">
        <summary className="cursor-pointer font-semibold text-navy underline underline-offset-2 marker:content-none hover:text-magenta">
          Cómo usamos tus datos
        </summary>
        <div className="mt-2 space-y-2 rounded-[11px] border border-linea bg-bg p-3.5">
          <p>
            <b className="font-semibold text-navy">Quién es responsable:</b> Qualita Studio, que
            guarda los datos que cargás en este formulario.
          </p>
          <p>
            <b className="font-semibold text-navy">Para qué:</b> generar el diagnóstico de tu
            sitio, mandarte el link al informe y, si corresponde, contactarte para repasarlo.
          </p>
          <p>
            <b className="font-semibold text-navy">Con quién se procesan:</b> los datos de la
            empresa y de su sitio pasan por las herramientas con las que hacemos el análisis. Tu
            nombre y tu email se guardan en nuestra base de datos y el email se usa solo para
            enviarte el informe. No los vendemos ni los cedemos.
          </p>
          <p>
            <b className="font-semibold text-navy">Tus derechos:</b> podés pedir ver, corregir o
            borrar tus datos escribiendo a{" "}
            <a href="mailto:hola@qualita.studio" className="font-semibold text-navy underline underline-offset-2">
              hola@qualita.studio
            </a>
            .
          </p>
          <p>
            El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a
            los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se
            acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14,
            inciso 3 de la Ley N° 25.326. La Agencia de Acceso a la Información Pública, en su
            carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las
            denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
            incumplimiento de las normas vigentes en materia de protección de datos personales.
          </p>
        </div>
      </details>
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[0.7rem] font-bold tracking-[0.2em] text-magenta uppercase">
      <span className="h-0.5 w-5 flex-none rounded-sm bg-coral" />
      {children}
    </span>
  );
}

/** Barra de progreso del mockup: un segmento por paso, gradiente en los hechos. */
function Progreso({ paso }: { paso: Paso }) {
  return (
    <div
      className="mt-4 mb-6 flex gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={2}
      aria-valuenow={paso}
      aria-label={`Paso ${paso} de 2`}
    >
      {([1, 2] as const).map((n) => (
        <span
          key={n}
          className={`h-1.5 flex-1 rounded-md transition-colors ${
            n <= paso ? "bg-[image:var(--grad)]" : "bg-linea"
          }`}
        />
      ))}
    </div>
  );
}

/** Campo trampa. Lo escondemos con CSS (fuera de pantalla) y no con
 *  `type=hidden` ni `display:none`: los bots suelen saltear esos dos. Un humano
 *  no lo ve ni lo alcanza con el tab, así que si llega con contenido es un bot. */
function Honeypot({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="company_website_url">No completes este campo</label>
      <input
        id="company_website_url"
        name="company_website_url"
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}

type CampoProps = {
  id: keyof CamposFormulario;
  label: string;
  hint?: string;
  placeholder?: string;
  valor: string;
  error?: string;
  onChange: (valor: string) => void;
  onBlur: () => void;
  type?: string;
  inputMode?: "url" | "email";
  autoComplete?: string;
};

function Campo({
  id,
  label,
  hint,
  placeholder,
  valor,
  error,
  onChange,
  onBlur,
  type = "text",
  inputMode,
  autoComplete,
}: CampoProps) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-[0.9rem] font-semibold text-navy">
        {label}{" "}
        {hint && <span className="text-[0.8rem] font-normal text-tinta2">{hint}</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-[12px] border-[1.5px] bg-white px-4 py-3.5 text-base text-navy transition outline-none placeholder:text-tinta2 ${
          error
            ? "border-warn focus:shadow-[0_0_0_4px_rgba(224,73,47,.12)]"
            : "border-linea focus:border-magenta focus:shadow-[0_0_0_4px_rgba(181,12,197,.1)]"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[0.82rem] text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

function CampoSelect({
  id,
  label,
  valor,
  error,
  onChange,
  onBlur,
  children,
}: {
  id: string;
  label: string;
  valor: string;
  error?: string;
  onChange: (valor: string) => void;
  onBlur: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-[0.9rem] font-semibold text-navy">
        {label}
      </label>
      {/* `relative` + `pr-10` + `appearance-none`: la flecha nativa quedaba
          pegada al borde y desalineada con la del combo de localidad, que está
          al lado. Ver Caret. */}
      <div className="relative">
        <select
          id={id}
          name={id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full appearance-none rounded-[12px] border-[1.5px] bg-white px-4 py-3.5 pr-10 text-base text-navy transition outline-none ${
            error
              ? "border-warn focus:shadow-[0_0_0_4px_rgba(224,73,47,.12)]"
              : "border-linea focus:border-magenta focus:shadow-[0_0_0_4px_rgba(181,12,197,.1)]"
          }`}
        >
          {children}
        </select>
        <Caret />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[0.82rem] text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

function AvisoError({ error }: { error: NonNullable<ErrorEnvio> }) {
  const duplicado = error.tipo === "duplicado";
  return (
    <div
      role="alert"
      className={`mt-6 rounded-[12px] border p-4 ${
        duplicado ? "border-[#e5d0f0] bg-[#f6eafd]" : "border-[#f5cfc6] bg-warnbg"
      }`}
    >
      <p
        className={`text-[0.9rem] font-semibold ${
          duplicado ? "text-magenta" : "text-warn"
        }`}
      >
        {error.mensaje}
      </p>
      {duplicado && (
        <p className="mt-1.5 text-[0.85rem] text-tinta">
          Si no encontrás el informe en tu casilla, escribinos a{" "}
          <a
            href="mailto:hola@qualita.studio"
            className="font-semibold text-navy underline underline-offset-2"
          >
            hola@qualita.studio
          </a>{" "}
          y te lo reenviamos.
        </p>
      )}
    </div>
  );
}

function Flecha({ atras = false }: { atras?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`flex-none ${atras ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-white/40 border-t-transparent"
    />
  );
}

function Candado() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="flex-none"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
