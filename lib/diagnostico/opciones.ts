/** Opciones del formulario del cliente. Sin dependencias: se importa desde
 *  componentes cliente y desde el servidor por igual. */

/** Las 23 provincias + CABA, en orden alfabético. */
export const PROVINCIAS = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Ciudad Autónoma de Buenos Aires",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export const PROVINCIA_DEFAULT = "Buenos Aires";

/** Rubros del mockup, más las verticales que ya trabaja Qualita. */
export const RUBROS = [
  "Desarrollo y construcción",
  "Indumentaria / textil",
  "Industria",
  "Servicios",
  "Comercio / retail",
  "Gastronomía y hotelería",
  "Salud",
  "Agro",
  "Tecnología",
  "Educación",
  "Otro",
] as const;

/** Coincide con el enum de client_type del endpoint. */
export const TIPOS_CLIENTE = [
  { value: "mayorista", label: "Mayorista / B2B" },
  { value: "minorista", label: "Minorista" },
  { value: "ambos", label: "Ambos" },
] as const;

export type TipoCliente = (typeof TIPOS_CLIENTE)[number]["value"];
