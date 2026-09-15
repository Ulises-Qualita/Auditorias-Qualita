"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { LOCALIDADES, etiquetaLocalidad } from "@/lib/diagnostico/opciones";
import Caret from "./Caret";

/** Para que "cordoba", "bahia blanca" o "tucuman" filtren igual que con acento. */
function sinAcentos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** El catálogo ya resuelto a la etiqueta que se guarda ("Bahía Blanca, Buenos
 *  Aires"), calculado una sola vez. */
const ETIQUETAS = LOCALIDADES.map(etiquetaLocalidad);

type Opcion = {
  etiqueta: string;
  /** true = "usar lo que escribió", no una fila del catálogo. */
  libre: boolean;
};

/** Combobox con búsqueda para elegir la localidad (patrón `.combo` del mockup).
 *
 *  A diferencia del combo de provincia que reemplaza, el catálogo no es
 *  exhaustivo: son ~270 localidades y el país tiene miles. Por eso lo tipeado
 *  también es un valor válido — se ofrece como "Usar «…»" al final de la lista
 *  y se confirma solo al cerrar. Así una PyME de un pueblo chico no queda
 *  trabada por no estar en la lista. */
export default function ComboLocalidad({
  id,
  valor,
  onChange,
  onCerrar,
  error,
  opcional = false,
}: {
  id: string;
  valor: string;
  onChange: (valor: string) => void;
  /** Se dispara al cerrar el combo, para revalidar desde el formulario.
   *  Recibe el valor que quedó confirmado: el `onChange` de arriba todavía no
   *  se aplicó al estado del padre cuando esto corre, así que validar contra
   *  `campos` daría el valor anterior. */
  onCerrar?: (valor: string) => void;
  error?: string;
  opcional?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resaltado, setResaltado] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const opciones = useMemo<Opcion[]>(() => {
    const limpio = busqueda.trim();
    if (!limpio) return ETIQUETAS.map((etiqueta) => ({ etiqueta, libre: false }));

    const q = sinAcentos(limpio);
    const delCatalogo = ETIQUETAS.filter((etiqueta) => sinAcentos(etiqueta).includes(q));
    // Si ya escribió exacto una del catálogo, ofrecerla de nuevo como "libre"
    // sería la misma opción dos veces.
    const yaEstá = delCatalogo.some((etiqueta) => sinAcentos(etiqueta) === q);

    return [
      ...delCatalogo.map((etiqueta) => ({ etiqueta, libre: false })),
      ...(yaEstá ? [] : [{ etiqueta: limpio, libre: true }]),
    ];
  }, [busqueda]);

  /** Cierra tomando lo que haya escrito: si tipeó algo y no eligió de la
   *  lista, ese texto ES la localidad. Perderlo en silencio sería peor. */
  const cerrar = useCallback(() => {
    const escrito = busqueda.trim();
    const confirmado = escrito || valor;
    if (escrito && escrito !== valor) onChange(escrito);
    setAbierto(false);
    setBusqueda("");
    onCerrar?.(confirmado);
  }, [busqueda, valor, onChange, onCerrar]);

  // Click afuera: cerramos confirmando lo tipeado (ver cerrar()).
  useEffect(() => {
    if (!abierto) return;
    function alClickear(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) cerrar();
    }
    document.addEventListener("mousedown", alClickear);
    return () => document.removeEventListener("mousedown", alClickear);
  }, [abierto, cerrar]);

  function abrir() {
    setBusqueda("");
    setResaltado(Math.max(0, ETIQUETAS.indexOf(valor)));
    setAbierto(true);
  }

  /** Cierra descartando lo tipeado (Escape). */
  function descartar() {
    setAbierto(false);
    setBusqueda("");
    onCerrar?.(valor);
  }

  function elegir(etiqueta: string) {
    onChange(etiqueta);
    setAbierto(false);
    setBusqueda("");
    onCerrar?.(etiqueta);
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      if (abierto) evento.stopPropagation();
      descartar();
      return;
    }
    if (evento.key === "Tab") {
      cerrar();
      return;
    }
    if (!abierto) {
      if (evento.key === "ArrowDown" || evento.key === "Enter") {
        evento.preventDefault();
        abrir();
      }
      return;
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setResaltado((i) => (opciones.length ? (i + 1) % opciones.length : 0));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setResaltado((i) => (opciones.length ? (i - 1 + opciones.length) % opciones.length : 0));
    } else if (evento.key === "Enter") {
      // Sin preventDefault el Enter dispararía el submit del form.
      evento.preventDefault();
      const elegida = opciones[resaltado];
      if (elegida) elegir(elegida.etiqueta);
      else cerrar();
    }
  }

  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-[0.9rem] font-semibold text-navy">
        Localidad{" "}
        {opcional && <span className="text-[0.8rem] font-normal text-tinta2">opcional</span>}
      </label>

      <div ref={contenedor} className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={
            abierto && opciones[resaltado] ? `${listaId}-${resaltado}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-ayuda`}
          autoComplete="off"
          placeholder="Ej. Bahía Blanca"
          value={abierto ? busqueda : valor}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setResaltado(0);
            if (!abierto) setAbierto(true);
          }}
          onFocus={abrir}
          onKeyDown={alTeclear}
          className={`w-full rounded-[12px] border-[1.5px] bg-white px-4 py-3.5 pr-10 text-base text-navy transition outline-none placeholder:text-tinta2 ${
            error
              ? "border-warn focus:shadow-[0_0_0_4px_rgba(224,73,47,.12)]"
              : "border-linea focus:border-magenta focus:shadow-[0_0_0_4px_rgba(181,12,197,.1)]"
          }`}
        />
        <Caret />

        {abierto && (
          <ul
            id={listaId}
            role="listbox"
            aria-label="Localidades"
            className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 max-h-60 overflow-y-auto rounded-[12px] border border-linea bg-white py-1 shadow-[0_1px_2px_rgba(37,40,81,.04),0_10px_28px_rgba(37,40,81,.10)]"
          >
            {opciones.map((opcion, indice) => (
              <li
                key={`${opcion.libre ? "libre" : "cat"}-${opcion.etiqueta}`}
                id={`${listaId}-${indice}`}
                role="option"
                aria-selected={!opcion.libre && opcion.etiqueta === valor}
                // onMouseDown, no onClick: el blur del input llegaría antes.
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(opcion.etiqueta);
                }}
                onMouseEnter={() => setResaltado(indice)}
                className={`cursor-pointer px-4 py-2.5 text-[0.95rem] text-navy ${
                  indice === resaltado ? "bg-[#f5f5fb]" : ""
                } ${!opcion.libre && opcion.etiqueta === valor ? "font-semibold" : ""} ${
                  opcion.libre ? "border-t border-linea2" : ""
                }`}
              >
                {opcion.libre ? (
                  <>
                    <span className="text-tinta2">Usar </span>
                    <span className="font-semibold">«{opcion.etiqueta}»</span>
                  </>
                ) : (
                  opcion.etiqueta
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[0.82rem] text-warn">
          {error}
        </p>
      ) : (
        <p id={`${id}-ayuda`} className="mt-1.5 text-[0.8rem] text-tinta2">
          Si no está en la lista, escribila igual.
        </p>
      )}
    </div>
  );
}
