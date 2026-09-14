/** Las mejoras de PageSpeed dichas como se le explican a un cliente.
 *
 *  Lighthouse titula en jerga ("Reduce el contenido JavaScript que no se use")
 *  y el informe habla en "vos" y sin tecnicismos. La traducción es de CÓDIGO,
 *  no del modelo: cada id de auditoría tiene su texto fijo, así el mismo
 *  hallazgo se dice siempre igual y no hay lugar para inventar.
 *
 *  Una auditoría sin entrada acá no llega al cliente (la ve igual el equipo en
 *  la consola, con el título de Lighthouse). Es preferible omitir una mejora
 *  rara a mostrarla en jerga.
 *
 *  Varias auditorías dicen lo mismo con otro id (Lighthouse renombró muchas
 *  como "insights"): comparten `grupo` y el informe muestra una sola. */

export type TextoMejora = {
  /** Varias auditorías equivalentes comparten grupo y se muestran una vez. */
  grupo: string;
  titulo: string;
  /** Recibe el ahorro en KB cuando Lighthouse lo informa. */
  detalle: (ahorroKb: number | null) => string;
};

const IMAGENES: TextoMejora = {
  grupo: "imagenes",
  titulo: "Imágenes más livianas",
  detalle: (kb) =>
    kb
      ? `Las imágenes pesan ${megas(kb)} más de lo necesario para un celular. Comprimirlas y servirlas en el tamaño justo acelera la carga.`
      : "Las imágenes pesan más de lo necesario para un celular. Comprimirlas y servirlas en el tamaño justo acelera la carga.",
};

const CODIGO_SOBRANTE: TextoMejora = {
  grupo: "codigo-sobrante",
  titulo: "Código que se descarga y no se usa",
  detalle: (kb) =>
    kb
      ? `La página descarga ${megas(kb)} de código que no usa: el celular lo baja igual antes de poder mostrarla.`
      : "La página descarga código que no usa: el celular lo baja igual antes de poder mostrarla.",
};

const PROCESAMIENTO: TextoMejora = {
  grupo: "procesamiento",
  titulo: "El celular trabaja de más",
  detalle: () =>
    "Procesar el código de la página ocupa al teléfono varios segundos, y mientras tanto no responde cuando lo tocan.",
};

const CACHE: TextoMejora = {
  grupo: "cache",
  titulo: "Aprovechar lo que ya se descargó",
  detalle: () =>
    "Quien vuelve a entrar descarga todo de nuevo en vez de reusar lo que su navegador ya tenía guardado.",
};

const BLOQUEO: TextoMejora = {
  grupo: "bloqueo",
  titulo: "Mostrar primero lo importante",
  detalle: () =>
    "Hay archivos que frenan la primera imagen de la página hasta que terminan de cargar.",
};

const IMAGEN_PRINCIPAL: TextoMejora = {
  grupo: "imagen-principal",
  titulo: "La imagen principal tarda en aparecer",
  detalle: () =>
    "Lo primero que debería verse de la página llega tarde: es lo que más pesa en la sensación de lentitud.",
};

const TERCEROS: TextoMejora = {
  grupo: "terceros",
  titulo: "Herramientas externas que frenan",
  detalle: () =>
    "Widgets, chats o etiquetas de otras empresas se cargan junto con la página y la demoran.",
};

const SERVIDOR: TextoMejora = {
  grupo: "servidor",
  titulo: "El servidor tarda en responder",
  detalle: () =>
    "Antes de empezar a mostrar algo, el sitio tarda en contestar. Suele depender del hosting.",
};

const SALTOS: TextoMejora = {
  grupo: "saltos",
  titulo: "La página se mueve mientras carga",
  detalle: () =>
    "Hay elementos que aparecen tarde y corren el contenido: quien iba a tocar un botón termina tocando otra cosa.",
};

const COMPRESION: TextoMejora = {
  grupo: "compresion",
  titulo: "Archivos sin comprimir",
  detalle: () => "Algunos archivos viajan sin comprimir y tardan más de lo necesario en llegar.",
};

export const TEXTOS_MEJORAS: Record<string, TextoMejora> = {
  // Rendimiento
  "image-delivery-insight": IMAGENES,
  "uses-optimized-images": IMAGENES,
  "modern-image-formats": IMAGENES,
  "uses-responsive-images": IMAGENES,
  "offscreen-images": IMAGENES,
  "efficient-animated-content": IMAGENES,
  "unused-javascript": CODIGO_SOBRANTE,
  "unused-css-rules": CODIGO_SOBRANTE,
  "duplicated-javascript-insight": CODIGO_SOBRANTE,
  "legacy-javascript-insight": CODIGO_SOBRANTE,
  "bootup-time": PROCESAMIENTO,
  "mainthread-work-breakdown": PROCESAMIENTO,
  "cache-insight": CACHE,
  "uses-long-cache-ttl": CACHE,
  "render-blocking-insight": BLOQUEO,
  "render-blocking-resources": BLOQUEO,
  "lcp-discovery-insight": IMAGEN_PRINCIPAL,
  "lcp-breakdown-insight": IMAGEN_PRINCIPAL,
  "third-parties-insight": TERCEROS,
  "third-party-summary": TERCEROS,
  "document-latency-insight": SERVIDOR,
  "server-response-time": SERVIDOR,
  "cls-culprits-insight": SALTOS,
  "unminified-javascript": COMPRESION,
  "unminified-css": COMPRESION,
  "uses-text-compression": COMPRESION,
  "total-byte-weight": {
    grupo: "peso",
    titulo: "Una página pesada para el celular",
    detalle: () => "La página completa pesa mucho: con datos móviles tarda y le consume el plan a quien la abre.",
  },
  "font-display-insight": {
    grupo: "fuentes",
    titulo: "Textos invisibles mientras cargan las fuentes",
    detalle: () => "Mientras se descarga la tipografía, los textos no se ven.",
  },
  "dom-size-insight": {
    grupo: "tamano-pagina",
    titulo: "Una página con demasiados elementos",
    detalle: () => "La home tiene tantos elementos que al celular le cuesta dibujarla y moverse por ella.",
  },

  // Accesibilidad
  "color-contrast": {
    grupo: "contraste",
    titulo: "Textos con poco contraste",
    detalle: () => "Hay textos difíciles de leer sobre su fondo, sobre todo al sol o en pantallas chicas.",
  },
  "image-alt": {
    grupo: "alt-imagenes",
    titulo: "Imágenes sin descripción",
    detalle: () =>
      "Algunas imágenes no dicen qué muestran: Google no las entiende y quien usa un lector de pantalla se las pierde.",
  },
  label: {
    grupo: "etiquetas-form",
    titulo: "Campos del formulario sin nombre",
    detalle: () =>
      "Algunos campos no tienen etiqueta: quien usa un lector de pantalla no sabe qué tiene que completar.",
  },
  "link-name": {
    grupo: "nombres-enlaces",
    titulo: "Enlaces y botones sin nombre",
    detalle: () => "Hay enlaces o botones que no dicen a dónde llevan ni qué hacen si no se los ve.",
  },
  "button-name": {
    grupo: "nombres-enlaces",
    titulo: "Enlaces y botones sin nombre",
    detalle: () => "Hay enlaces o botones que no dicen a dónde llevan ni qué hacen si no se los ve.",
  },
  "target-size": {
    grupo: "tamano-toque",
    titulo: "Botones chicos para el dedo",
    detalle: () => "Algunos botones o enlaces son chicos o están muy juntos para tocarlos bien desde el celular.",
  },
  "heading-order": {
    grupo: "orden-titulos",
    titulo: "Títulos fuera de orden",
    detalle: () => "Los títulos de la página saltan de nivel: se pierde la jerarquía de qué es principal y qué secundario.",
  },
  "html-has-lang": {
    grupo: "idioma",
    titulo: "Idioma de la página sin declarar",
    detalle: () => "La página no dice en qué idioma está, y los lectores de pantalla pueden leerla mal.",
  },
  "meta-viewport": {
    grupo: "zoom",
    titulo: "Zoom bloqueado en el celular",
    detalle: () => "La página no deja agrandar con los dedos, y a quien le cuesta leer letra chica no le queda opción.",
  },

  // Prácticas recomendadas
  "third-party-cookies": {
    grupo: "cookies-terceros",
    titulo: "Cookies de terceros",
    detalle: () =>
      "El sitio usa cookies de otras empresas, que los navegadores están dejando de aceptar: lo que dependa de ellas puede dejar de funcionar.",
  },
  "errors-in-console": {
    grupo: "errores",
    titulo: "Errores al cargar la página",
    detalle: () => "La página registra errores mientras carga: puede haber algo que no está funcionando.",
  },
  "is-on-https": {
    grupo: "https",
    titulo: "Partes del sitio sin conexión segura",
    detalle: () => "Algo del sitio se carga sin conexión segura, y el navegador puede advertirlo o bloquearlo.",
  },
  "image-aspect-ratio": {
    grupo: "imagenes-deformadas",
    titulo: "Imágenes deformadas",
    detalle: () => "Algunas imágenes se muestran estiradas o aplastadas respecto de su forma original.",
  },
  "image-size-responsive": {
    grupo: "imagenes-borrosas",
    titulo: "Imágenes borrosas en el celular",
    detalle: () => "Algunas imágenes tienen menos resolución de la que necesita la pantalla y se ven borrosas.",
  },
  deprecations: {
    grupo: "obsoleto",
    titulo: "Funciones que los navegadores van a retirar",
    detalle: () => "El sitio usa funciones que los navegadores están dejando de soportar.",
  },

  // SEO
  "meta-description": {
    grupo: "meta-description",
    titulo: "Sin descripción para Google",
    detalle: () => "La página no tiene la descripción que Google muestra debajo del título en los resultados.",
  },
  "document-title": {
    grupo: "titulo",
    titulo: "Sin título de página",
    detalle: () => "La página no tiene título, que es lo primero que muestra Google en los resultados.",
  },
  "link-text": {
    grupo: "texto-enlaces",
    titulo: "Enlaces con texto genérico",
    detalle: () => "Hay enlaces que dicen \"clic acá\" o \"ver más\": no le cuentan a Google a dónde llevan.",
  },
  "crawlable-anchors": {
    grupo: "enlaces-rastreables",
    titulo: "Enlaces que Google no puede seguir",
    detalle: () => "Algunos enlaces están armados de una forma que Google no puede recorrer.",
  },
  "is-crawlable": {
    grupo: "indexable",
    titulo: "La página le pide a Google que no la muestre",
    detalle: () => "La home tiene una indicación para que Google no la incluya en los resultados de búsqueda.",
  },
  "robots-txt": {
    grupo: "robots",
    titulo: "Instrucciones para Google con errores",
    detalle: () => "El archivo que le indica a Google qué puede recorrer tiene errores.",
  },
  canonical: {
    grupo: "canonical",
    titulo: "Dirección principal mal declarada",
    detalle: () => "La página le indica a Google una dirección principal que no es válida.",
  },
  "http-status-code": {
    grupo: "estado-http",
    titulo: "La página responde con error",
    detalle: () => "Google recibe un código de error al pedir la página.",
  },
  "font-size": {
    grupo: "letra-chica",
    titulo: "Letra chica en el celular",
    detalle: () => "Buena parte del texto es demasiado chico para leerlo cómodo en un teléfono.",
  },
};

function megas(kb: number): string {
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toLocaleString("es-AR", { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}
