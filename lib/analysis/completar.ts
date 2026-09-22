import "server-only";

import type { SiteFacts } from "./collect";
import type { LecturaPagina } from "./lecturas";
import type { AnalysisOutput } from "./schema";

/** Lo que el CÓDIGO completa del informe antes de guardarlo, cuando el modelo
 *  dejó un hueco que los hechos ya pueden llenar.
 *
 *  No inventa nada: cada dato sale de los facts o de una lectura de esta misma
 *  corrida, igual que la tabla de medición. Corre al guardar (guardarAnalisis)
 *  y no al dibujar, porque el informe público no recibe ni los facts ni los
 *  campos de los formularios: zod los descarta para que no lleguen al browser. */

type Activos = AnalysisOutput["activos"];
type Captacion = AnalysisOutput["captacion"];

/** Cuántas tarjetas tiene la lámina "Punto de partida". La grilla es de 3
 *  columnas: con 5 queda un hueco. */
const TARJETAS = 6;

/** Completa las tarjetas hasta 6 con números verificados de esta corrida.
 *
 *  El modelo elige primero —son sus hallazgos, y suele traer lo de afuera
 *  (reseñas, seguidores, posiciones) que el código no tiene—; esto solo
 *  rellena lo que falte, sin repetir un número que ya esté puesto. */
export function completarActivos(
  activos: Activos,
  facts: SiteFacts,
  lecturas: LecturaPagina[],
  competidores: number,
): Activos {
  const completos = [...activos];
  for (const candidato of candidatosDeFacts(facts, lecturas, competidores)) {
    if (completos.length >= TARJETAS) break;
    if (completos.some((activo) => mismoNumero(activo.dato, candidato.dato))) continue;
    completos.push(candidato);
  }
  return completos.slice(0, TARJETAS);
}

/** "37 páginas" y "37 internas" son la misma tarjeta dicha de dos formas: lo
 *  que compara es la cifra, no el texto. */
function mismoNumero(a: string, b: string): boolean {
  const cifra = (texto: string) => texto.trim().match(/^[+#~<>≈]?[\d.,]+/)?.[0] ?? texto.trim();
  return cifra(a) === cifra(b);
}

function candidatosDeFacts(
  facts: SiteFacts,
  lecturas: LecturaPagina[],
  competidores: number,
): Activos {
  const candidatos: Activos = [];
  const { seo, contacto, tracking, pageSpeed } = facts;

  if (seo && seo.urlsInternasTotal > 0) {
    candidatos.push({
      dato: `${seo.urlsInternasTotal} páginas`,
      etiqueta: "Páginas internas enlazadas desde la home: el material que ya existe para ordenar",
    });
  }
  if (contacto && contacto.viasTotal > 0) {
    candidatos.push({
      dato: `${contacto.viasTotal} de 4`,
      etiqueta: "Vías de contacto detectadas en la home: teléfono, mail, WhatsApp y formulario",
    });
  }
  if (typeof pageSpeed?.performance === "number") {
    candidatos.push({
      dato: `${pageSpeed.performance}/100`,
      etiqueta: "Rendimiento de la home en celular, medido con PageSpeed de Google",
    });
  }
  if (competidores > 0) {
    candidatos.push({
      dato: `${competidores}`,
      etiqueta: "Competidores del sector relevados para comparar contra ellos, uno por uno",
    });
  }
  const leidas = lecturas.filter((lectura) => lectura.ok).length;
  if (leidas > 0) {
    candidatos.push({
      dato: `${leidas} leídas`,
      etiqueta: "Páginas del sitio y de la competencia abiertas y revisadas en esta corrida",
    });
  }
  if (tracking) {
    const puestas = [
      tracking.ga4,
      tracking.gtm,
      tracking.metaPixel,
      tracking.googleAdsConversion,
    ].filter(Boolean).length;
    candidatos.push({
      dato: `${puestas} de 4`,
      etiqueta: "Etiquetas de medición detectadas: analítica, Tag Manager, píxel y conversión",
    });
  }
  if (seo?.titleLength) {
    candidatos.push({
      dato: `${seo.titleLength} car.`,
      etiqueta: "Largo del título de la home, lo primero que lee quien la encuentra en Google",
    });
  }

  return candidatos;
}

/** Arma la columna del competidor de la lámina de captación cuando el modelo
 *  la dejó vacía y una lectura de esta corrida sí trae un formulario.
 *
 *  Pasó en 3 de las primeras 4 auditorías: el código había leído el formulario
 *  de un competidor y la lámina igual decía "a validar". */
export function completarCaptacion(
  captacion: Captacion | null | undefined,
  lecturas: LecturaPagina[],
): Captacion | null | undefined {
  if (!captacion || captacion.competidor) return captacion;

  const conFormulario = lecturas.find(
    (lectura) =>
      lectura.para === "competidor" && lectura.ok && (lectura.contacto?.campos.length ?? 0) > 0,
  );
  if (!conFormulario) return captacion;

  const campos = [...new Set(conFormulario.contacto!.campos.map(nombreDeCampo))]
    .filter((texto) => texto.length > 0)
    .slice(0, 8)
    .map((texto) => ({ texto, destacado: false }));
  if (campos.length === 0) return captacion;

  return {
    ...captacion,
    competidor: {
      etiqueta: recortar(`${conFormulario.dominio ?? "Competidor"} · ${ruta(conFormulario)}`, 60),
      campos,
      nota: "Campos detectados en el código de esa página en esta corrida, con el mismo lector que el formulario de arriba.",
    },
  };
}

/** Del atributo `name` del HTML al nombre que lee una persona.
 *
 *  Vienen como "tipo-consulta (select)" y, en los sitios hechos con
 *  constructores visuales, como "form_fields[2c6a8c6] (text)": el nombre real
 *  está adentro de los corchetes y a veces es un id generado, que no dice nada
 *  y no va al informe. */
const CAMPOS_CONOCIDOS: Record<string, string> = {
  name: "Nombre",
  nombre: "Nombre",
  apellido: "Apellido",
  email: "Email",
  mail: "Email",
  correo: "Email",
  tel: "Teléfono",
  telefono: "Teléfono",
  phone: "Teléfono",
  celular: "Celular",
  whatsapp: "WhatsApp",
  message: "Mensaje",
  mensaje: "Mensaje",
  consulta: "Consulta",
  comentario: "Comentario",
  asunto: "Asunto",
  subject: "Asunto",
  empresa: "Empresa",
  company: "Empresa",
  ciudad: "Ciudad",
  localidad: "Localidad",
  direccion: "Dirección",
  producto: "Producto",
  servicio: "Servicio",
  presupuesto: "Presupuesto",
  metros: "Metros",
  m2: "m²",
};

/** Cuando el nombre no sirve, el tipo del input igual dice qué se pide. */
const CAMPOS_POR_TIPO: Record<string, string> = {
  tel: "Teléfono",
  email: "Email",
  textarea: "Mensaje",
  number: "Número",
  date: "Fecha",
  file: "Archivo",
};

function nombreDeCampo(campo: string): string {
  const [sinTipo, tipoCrudo] = [campo.split(" (")[0].trim(), campo.match(/\(([^)]+)\)\s*$/)?.[1]];
  const porTipo = tipoCrudo ? (CAMPOS_POR_TIPO[tipoCrudo.trim().toLowerCase()] ?? "") : "";

  // El nombre real de un campo de constructor visual va entre corchetes.
  const crudo = sinTipo.match(/\[([^\]]+)\]/)?.[1] ?? sinTipo;
  const limpio = crudo.replace(/[_-]+/g, " ").trim().toLowerCase();

  const conocido = CAMPOS_CONOCIDOS[limpio.replace(/\s+/g, "")];
  if (conocido) return conocido;

  // Un id generado ("2c6a8c6", "item meta[1]") o un texto de ejemplo del propio
  // formulario ("Contanos un poco lo que tengas en mente…") no son el nombre
  // del campo: ahí manda el tipo.
  const esId = /^[0-9a-f]{4,}$/i.test(limpio.replace(/\s+/g, "")) || !/[aeiouáéíóú]/i.test(limpio);
  const esEjemplo = limpio.length > 24 || limpio.includes("...") || limpio.includes("…");
  if (!limpio || esId || esEjemplo) return porTipo;

  return recortar(limpio.charAt(0).toUpperCase() + limpio.slice(1), 42);
}

function ruta(lectura: LecturaPagina): string {
  try {
    return new URL(lectura.finalUrl ?? lectura.url).pathname || "/";
  } catch {
    return "/";
  }
}

function recortar(texto: string, largo: number): string {
  return texto.length <= largo ? texto : `${texto.slice(0, largo - 1)}…`;
}
