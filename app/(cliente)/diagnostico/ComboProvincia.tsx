"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PROVINCIAS } from "@/lib/diagnostico/opciones";

/** Para que "cordoba", "rio negro" o "tucuman" filtren igual que con acento. */
function sinAcentos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Combobox con búsqueda para elegir provincia (patrón `.combo` del mockup).
 *
 *  El valor que sale es siempre una provincia de la lista: lo que se tipea es
 *  solo un filtro. Si al cerrar el texto no coincide con ninguna, volvemos al
 *  último valor válido en vez de mandar algo que el informe no sabe ubicar. */
export default function ComboProvincia({
  id,
  valor,
  onChange,
}: {
  id: string;
  valor: string;
  onChange: (valor: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resaltado, setResaltado] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const opciones = useMemo(() => {
    const q = sinAcentos(busqueda.trim());
    if (!q) return [...PROVINCIAS];
    return PROVINCIAS.filter((p) => sinAcentos(p).includes(q));
  }, [busqueda]);

  // Click afuera: cerramos y descartamos lo tipeado.
  useEffect(() => {
    if (!abierto) return;
    function alClickear(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) cerrar();
    }
    document.addEventListener("mousedown", alClickear);
    return () => document.removeEventListener("mousedown", alClickear);
  }, [abierto]);

  function abrir() {
    setBusqueda("");
    setResaltado(Math.max(0, PROVINCIAS.indexOf(valor as (typeof PROVINCIAS)[number])));
    setAbierto(true);
  }

  /** Cierra sin elegir: el input vuelve a mostrar el valor confirmado. */
  function cerrar() {
    setAbierto(false);
    setBusqueda("");
  }

  function elegir(provincia: string) {
    onChange(provincia);
    setAbierto(false);
    setBusqueda("");
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      if (abierto) evento.stopPropagation();
      cerrar();
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
      if (elegida) elegir(elegida);
    }
  }

  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-[0.9rem] font-semibold text-navy">
        Provincia{" "}
        <span className="text-[0.8rem] font-normal text-tinta2">opcional</span>
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
          autoComplete="off"
          placeholder="Elegí tu provincia"
          value={abierto ? busqueda : valor}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setResaltado(0);
            if (!abierto) setAbierto(true);
          }}
          onFocus={abrir}
          onKeyDown={alTeclear}
          className="w-full rounded-[12px] border-[1.5px] border-linea bg-white px-4 py-3.5 pr-10 text-base text-navy transition outline-none placeholder:text-tinta2 focus:border-magenta focus:shadow-[0_0_0_4px_rgba(181,12,197,.1)]"
        />
        <Caret />

        {abierto && (
          <ul
            id={listaId}
            role="listbox"
            aria-label="Provincias"
            className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 max-h-60 overflow-y-auto rounded-[12px] border border-linea bg-white py-1 shadow-[0_1px_2px_rgba(37,40,81,.04),0_10px_28px_rgba(37,40,81,.10)]"
          >
            {opciones.length === 0 && (
              <li className="px-4 py-2.5 text-[0.95rem] text-tinta2">Sin resultados</li>
            )}
            {opciones.map((provincia, indice) => (
              <li
                key={provincia}
                id={`${listaId}-${indice}`}
                role="option"
                aria-selected={provincia === valor}
                // onMouseDown, no onClick: el blur del input llegaría antes.
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(provincia);
                }}
                onMouseEnter={() => setResaltado(indice)}
                className={`cursor-pointer px-4 py-2.5 text-[0.95rem] ${
                  indice === resaltado ? "bg-[#f5f5fb] text-navy" : "text-navy"
                } ${provincia === valor ? "font-semibold" : ""}`}
              >
                {provincia}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Caret() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-tinta2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
