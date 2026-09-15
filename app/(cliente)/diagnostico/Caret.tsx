/** La flechita de los campos que despliegan algo.
 *
 *  La dibujamos nosotros incluso en el `<select>` nativo (que trae la suya):
 *  cada browser la pone a una distancia distinta del borde, y al lado del
 *  combo de localidad —que sí o sí es un SVG propio— se notaba desalineada.
 *  Va posicionada en absoluto, así que el contenedor tiene que ser `relative`
 *  y el campo dejar `pr-10` de aire. */
export default function Caret() {
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
