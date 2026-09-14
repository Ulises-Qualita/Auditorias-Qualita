"use client";

import { useState, useTransition } from "react";

import ComboProvincia from "@/app/(cliente)/diagnostico/ComboProvincia";
import { PROVINCIA_DEFAULT, RUBROS, TIPOS_CLIENTE } from "@/lib/diagnostico/opciones";
import { esUrlValida, normalizarWebsite } from "@/lib/diagnostico/validacion";
import { generarDiagnostico } from "../actions";

/** El paso 1 del form público, en versión consola: empresa, sitio, rubro,
 *  provincia y a quién le vende. Sin contacto y sin honeypot (acá solo entra
 *  el equipo con sesión). Reusa las opciones, la validación y el combo de
 *  provincia del form del cliente para no tener dos criterios. */

type Campos = {
  name: string;
  website: string;
  industry: string;
  province: string;
  client_type: string;
};

const INICIALES: Campos = {
  name: "",
  website: "",
  industry: "",
  province: PROVINCIA_DEFAULT,
  client_type: "",
};

export function FormInterno() {
  const [campos, setCampos] = useState<Campos>(INICIALES);
  const [errorSitio, setErrorSitio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const puedeEnviar = campos.name.trim().length > 0 && esUrlValida(campos.website) && !pendiente;

  function actualizar<K extends keyof Campos>(campo: K, valor: string) {
    setCampos((previo) => ({ ...previo, [campo]: valor }));
    if (campo === "website") setErrorSitio(null);
  }

  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!puedeEnviar) return;
    setError(null);

    const payload = {
      name: campos.name.trim(),
      website: normalizarWebsite(campos.website),
      industry: campos.industry.trim(),
      province: campos.province.trim(),
      ...(campos.client_type ? { client_type: campos.client_type } : {}),
    };

    startTransition(async () => {
      // Si sale bien, la action redirige al detalle y esto no vuelve.
      const res = await generarDiagnostico(payload);
      setError(res.error);
    });
  }

  return (
    <form
      onSubmit={alEnviar}
      noValidate
      className="rounded-card border border-linea bg-card p-6 shadow-qualita"
    >
      <Etiqueta htmlFor="name">Nombre de la empresa</Etiqueta>
      <input
        id="name"
        value={campos.name}
        onChange={(e) => actualizar("name", e.target.value)}
        placeholder="Ej. Constructora del Sur S.A."
        autoComplete="off"
        className={INPUT}
      />

      <Etiqueta htmlFor="website" opcional>
        Sitio web
      </Etiqueta>
      <input
        id="website"
        value={campos.website}
        onChange={(e) => actualizar("website", e.target.value)}
        onBlur={() => {
          const normalizado = normalizarWebsite(campos.website);
          if (normalizado !== campos.website) actualizar("website", normalizado);
          setErrorSitio(esUrlValida(normalizado) ? null : "El sitio no es una URL válida");
        }}
        placeholder="https://empresa.com"
        inputMode="url"
        autoComplete="off"
        aria-invalid={errorSitio ? true : undefined}
        aria-describedby={errorSitio ? "website-error" : undefined}
        className={`${INPUT} ${errorSitio ? "border-warn" : ""}`}
      />
      {errorSitio ? (
        <p id="website-error" className="-mt-3 mb-4 text-[0.8rem] text-warn">
          {errorSitio}
        </p>
      ) : (
        <p className="-mt-3 mb-4 text-[0.78rem] text-tinta2">
          Sin sitio, el análisis no tiene qué mirar: el informe sale casi todo a validar.
        </p>
      )}

      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <div>
          <Etiqueta htmlFor="industry" opcional>
            Rubro
          </Etiqueta>
          <select
            id="industry"
            value={campos.industry}
            onChange={(e) => actualizar("industry", e.target.value)}
            className={INPUT}
          >
            <option value="">Seleccioná…</option>
            {RUBROS.map((rubro) => (
              <option key={rubro} value={rubro}>
                {rubro}
              </option>
            ))}
          </select>
        </div>
        <ComboProvincia
          id="province"
          valor={campos.province}
          onChange={(v) => actualizar("province", v)}
        />
      </div>

      <fieldset className="mb-2">
        <legend className="mb-2 text-[0.85rem] font-semibold text-navy">
          ¿A quién le vende? <span className="font-normal text-tinta2">opcional</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_CLIENTE.map((tipo) => {
            const activo = campos.client_type === tipo.value;
            return (
              <label
                key={tipo.value}
                className={`cursor-pointer rounded-full border px-4 py-2 text-[0.84rem] font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-magenta/40 ${
                  activo ? "border-navy bg-navy text-white" : "border-linea text-navy hover:border-tinta2"
                }`}
              >
                <input
                  type="radio"
                  name="client_type"
                  value={tipo.value}
                  checked={activo}
                  // Un segundo click sobre el elegido lo desmarca: es opcional.
                  onClick={() => activo && actualizar("client_type", "")}
                  onChange={() => actualizar("client_type", tipo.value)}
                  className="sr-only"
                />
                {tipo.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-campo border border-warn/25 bg-warnbg px-3 py-2 text-[0.84rem] font-medium text-warn"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-linea2 pt-5">
        <button
          type="submit"
          disabled={!puedeEnviar}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.88rem] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: "var(--grad)" }}
        >
          {pendiente ? "Generando…" : "Generar diagnóstico"}
        </button>
        <p className="text-[0.8rem] text-tinta2">
          Queda en Diagnósticos internos, sin contacto y sin contar como lead.
        </p>
      </div>
    </form>
  );
}

const INPUT =
  "mb-4 w-full rounded-campo border border-linea bg-white px-3.5 py-2.5 text-[0.92rem] text-navy outline-none transition placeholder:text-tinta2 focus:border-magenta focus:shadow-[0_0_0_3px_rgba(181,12,197,.1)]";

function Etiqueta({
  htmlFor,
  opcional,
  children,
}: {
  htmlFor: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[0.85rem] font-semibold text-navy">
      {children} {opcional ? <span className="font-normal text-tinta2">opcional</span> : null}
    </label>
  );
}
