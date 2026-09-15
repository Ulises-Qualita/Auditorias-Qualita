/** Opciones del formulario del cliente. Sin dependencias: se importa desde
 *  componentes cliente y desde el servidor por igual. */

export type Localidad = {
  nombre: string;
  /** Provincia a la que pertenece. Desambigua los nombres repetidos (Merlo,
   *  Mercedes, Rivadavia…) y viaja pegada al nombre. */
  provincia: string;
};

/** Localidades para el combo de zona: las capitales, las ciudades grandes y
 *  el sudoeste bonaerense con más detalle (es donde trabaja Qualita). NO es el
 *  padrón completo del país a propósito: el combo deja escribir una localidad
 *  que no esté en la lista.
 *
 *  Se mantienen agrupadas por provincia porque así se leen y se corrigen; el
 *  combo las muestra alfabéticas (ver LOCALIDADES). */
const CATALOGO: readonly Localidad[] = [
  // Ciudad Autónoma de Buenos Aires
  { nombre: "Ciudad Autónoma de Buenos Aires", provincia: "Ciudad Autónoma de Buenos Aires" },

  // Buenos Aires — sudoeste (la zona de Qualita)
  { nombre: "Bahía Blanca", provincia: "Buenos Aires" },
  { nombre: "Punta Alta", provincia: "Buenos Aires" },
  { nombre: "Coronel Suárez", provincia: "Buenos Aires" },
  { nombre: "Coronel Pringles", provincia: "Buenos Aires" },
  { nombre: "Coronel Dorrego", provincia: "Buenos Aires" },
  { nombre: "Tres Arroyos", provincia: "Buenos Aires" },
  { nombre: "Pigüé", provincia: "Buenos Aires" },
  { nombre: "Tornquist", provincia: "Buenos Aires" },
  { nombre: "Monte Hermoso", provincia: "Buenos Aires" },
  { nombre: "Médanos", provincia: "Buenos Aires" },
  { nombre: "Carhué", provincia: "Buenos Aires" },
  { nombre: "Darregueira", provincia: "Buenos Aires" },
  { nombre: "Puán", provincia: "Buenos Aires" },
  { nombre: "Guaminí", provincia: "Buenos Aires" },
  { nombre: "Carmen de Patagones", provincia: "Buenos Aires" },

  // Buenos Aires — interior
  { nombre: "La Plata", provincia: "Buenos Aires" },
  { nombre: "Mar del Plata", provincia: "Buenos Aires" },
  { nombre: "Tandil", provincia: "Buenos Aires" },
  { nombre: "Olavarría", provincia: "Buenos Aires" },
  { nombre: "Azul", provincia: "Buenos Aires" },
  { nombre: "Necochea", provincia: "Buenos Aires" },
  { nombre: "Balcarce", provincia: "Buenos Aires" },
  { nombre: "Miramar", provincia: "Buenos Aires" },
  { nombre: "Villa Gesell", provincia: "Buenos Aires" },
  { nombre: "Pinamar", provincia: "Buenos Aires" },
  { nombre: "Santa Teresita", provincia: "Buenos Aires" },
  { nombre: "San Clemente del Tuyú", provincia: "Buenos Aires" },
  { nombre: "Dolores", provincia: "Buenos Aires" },
  { nombre: "Chascomús", provincia: "Buenos Aires" },
  { nombre: "Las Flores", provincia: "Buenos Aires" },
  { nombre: "Rauch", provincia: "Buenos Aires" },
  { nombre: "Ayacucho", provincia: "Buenos Aires" },
  { nombre: "Benito Juárez", provincia: "Buenos Aires" },
  { nombre: "Laprida", provincia: "Buenos Aires" },
  { nombre: "Saladillo", provincia: "Buenos Aires" },
  { nombre: "Bolívar", provincia: "Buenos Aires" },
  { nombre: "Daireaux", provincia: "Buenos Aires" },
  { nombre: "Bragado", provincia: "Buenos Aires" },
  { nombre: "Chivilcoy", provincia: "Buenos Aires" },
  { nombre: "Chacabuco", provincia: "Buenos Aires" },
  { nombre: "Junín", provincia: "Buenos Aires" },
  { nombre: "Pergamino", provincia: "Buenos Aires" },
  { nombre: "San Nicolás de los Arroyos", provincia: "Buenos Aires" },
  { nombre: "Zárate", provincia: "Buenos Aires" },
  { nombre: "Campana", provincia: "Buenos Aires" },
  { nombre: "Luján", provincia: "Buenos Aires" },
  { nombre: "Mercedes", provincia: "Buenos Aires" },
  { nombre: "9 de Julio", provincia: "Buenos Aires" },
  { nombre: "Pehuajó", provincia: "Buenos Aires" },
  { nombre: "Trenque Lauquen", provincia: "Buenos Aires" },
  { nombre: "General Villegas", provincia: "Buenos Aires" },
  { nombre: "Lincoln", provincia: "Buenos Aires" },

  // Buenos Aires — conurbano
  { nombre: "Avellaneda", provincia: "Buenos Aires" },
  { nombre: "Quilmes", provincia: "Buenos Aires" },
  { nombre: "Berazategui", provincia: "Buenos Aires" },
  { nombre: "Florencio Varela", provincia: "Buenos Aires" },
  { nombre: "Lanús", provincia: "Buenos Aires" },
  { nombre: "Lomas de Zamora", provincia: "Buenos Aires" },
  { nombre: "Adrogué", provincia: "Buenos Aires" },
  { nombre: "Monte Grande", provincia: "Buenos Aires" },
  { nombre: "Ezeiza", provincia: "Buenos Aires" },
  { nombre: "San Justo", provincia: "Buenos Aires" },
  { nombre: "Morón", provincia: "Buenos Aires" },
  { nombre: "Ramos Mejía", provincia: "Buenos Aires" },
  { nombre: "Hurlingham", provincia: "Buenos Aires" },
  { nombre: "Ituzaingó", provincia: "Buenos Aires" },
  { nombre: "Caseros", provincia: "Buenos Aires" },
  { nombre: "San Martín", provincia: "Buenos Aires" },
  { nombre: "Vicente López", provincia: "Buenos Aires" },
  { nombre: "San Isidro", provincia: "Buenos Aires" },
  { nombre: "San Fernando", provincia: "Buenos Aires" },
  { nombre: "Tigre", provincia: "Buenos Aires" },
  { nombre: "San Miguel", provincia: "Buenos Aires" },
  { nombre: "José C. Paz", provincia: "Buenos Aires" },
  { nombre: "Los Polvorines", provincia: "Buenos Aires" },
  { nombre: "Moreno", provincia: "Buenos Aires" },
  { nombre: "Merlo", provincia: "Buenos Aires" },
  { nombre: "Pilar", provincia: "Buenos Aires" },
  { nombre: "Escobar", provincia: "Buenos Aires" },
  { nombre: "Berisso", provincia: "Buenos Aires" },
  { nombre: "Ensenada", provincia: "Buenos Aires" },

  // Catamarca
  { nombre: "San Fernando del Valle de Catamarca", provincia: "Catamarca" },
  { nombre: "Belén", provincia: "Catamarca" },
  { nombre: "Andalgalá", provincia: "Catamarca" },
  { nombre: "Tinogasta", provincia: "Catamarca" },
  { nombre: "Santa María", provincia: "Catamarca" },

  // Chaco
  { nombre: "Resistencia", provincia: "Chaco" },
  { nombre: "Presidencia Roque Sáenz Peña", provincia: "Chaco" },
  { nombre: "Villa Ángela", provincia: "Chaco" },
  { nombre: "Charata", provincia: "Chaco" },
  { nombre: "Barranqueras", provincia: "Chaco" },
  { nombre: "Fontana", provincia: "Chaco" },
  { nombre: "Quitilipi", provincia: "Chaco" },
  { nombre: "Machagai", provincia: "Chaco" },

  // Chubut
  { nombre: "Rawson", provincia: "Chubut" },
  { nombre: "Trelew", provincia: "Chubut" },
  { nombre: "Puerto Madryn", provincia: "Chubut" },
  { nombre: "Comodoro Rivadavia", provincia: "Chubut" },
  { nombre: "Rada Tilly", provincia: "Chubut" },
  { nombre: "Esquel", provincia: "Chubut" },
  { nombre: "Trevelin", provincia: "Chubut" },
  { nombre: "Gaiman", provincia: "Chubut" },
  { nombre: "Sarmiento", provincia: "Chubut" },

  // Córdoba
  { nombre: "Córdoba", provincia: "Córdoba" },
  { nombre: "Villa Carlos Paz", provincia: "Córdoba" },
  { nombre: "Río Cuarto", provincia: "Córdoba" },
  { nombre: "Villa María", provincia: "Córdoba" },
  { nombre: "San Francisco", provincia: "Córdoba" },
  { nombre: "Río Tercero", provincia: "Córdoba" },
  { nombre: "Alta Gracia", provincia: "Córdoba" },
  { nombre: "Jesús María", provincia: "Córdoba" },
  { nombre: "Cosquín", provincia: "Córdoba" },
  { nombre: "La Falda", provincia: "Córdoba" },
  { nombre: "Villa Dolores", provincia: "Córdoba" },
  { nombre: "Bell Ville", provincia: "Córdoba" },
  { nombre: "Marcos Juárez", provincia: "Córdoba" },
  { nombre: "Cruz del Eje", provincia: "Córdoba" },
  { nombre: "Arroyito", provincia: "Córdoba" },
  { nombre: "Laboulaye", provincia: "Córdoba" },
  { nombre: "Villa Allende", provincia: "Córdoba" },
  { nombre: "Río Ceballos", provincia: "Córdoba" },
  { nombre: "Unquillo", provincia: "Córdoba" },

  // Corrientes
  { nombre: "Corrientes", provincia: "Corrientes" },
  { nombre: "Goya", provincia: "Corrientes" },
  { nombre: "Paso de los Libres", provincia: "Corrientes" },
  { nombre: "Mercedes", provincia: "Corrientes" },
  { nombre: "Curuzú Cuatiá", provincia: "Corrientes" },
  { nombre: "Esquina", provincia: "Corrientes" },
  { nombre: "Monte Caseros", provincia: "Corrientes" },
  { nombre: "Santo Tomé", provincia: "Corrientes" },
  { nombre: "Ituzaingó", provincia: "Corrientes" },

  // Entre Ríos
  { nombre: "Paraná", provincia: "Entre Ríos" },
  { nombre: "Concordia", provincia: "Entre Ríos" },
  { nombre: "Gualeguaychú", provincia: "Entre Ríos" },
  { nombre: "Concepción del Uruguay", provincia: "Entre Ríos" },
  { nombre: "Gualeguay", provincia: "Entre Ríos" },
  { nombre: "Villaguay", provincia: "Entre Ríos" },
  { nombre: "Colón", provincia: "Entre Ríos" },
  { nombre: "Victoria", provincia: "Entre Ríos" },
  { nombre: "Chajarí", provincia: "Entre Ríos" },
  { nombre: "Federación", provincia: "Entre Ríos" },
  { nombre: "Nogoyá", provincia: "Entre Ríos" },
  { nombre: "La Paz", provincia: "Entre Ríos" },

  // Formosa
  { nombre: "Formosa", provincia: "Formosa" },
  { nombre: "Clorinda", provincia: "Formosa" },
  { nombre: "Pirané", provincia: "Formosa" },
  { nombre: "El Colorado", provincia: "Formosa" },
  { nombre: "Las Lomitas", provincia: "Formosa" },

  // Jujuy
  { nombre: "San Salvador de Jujuy", provincia: "Jujuy" },
  { nombre: "San Pedro de Jujuy", provincia: "Jujuy" },
  { nombre: "Libertador General San Martín", provincia: "Jujuy" },
  { nombre: "Palpalá", provincia: "Jujuy" },
  { nombre: "Perico", provincia: "Jujuy" },
  { nombre: "La Quiaca", provincia: "Jujuy" },
  { nombre: "Humahuaca", provincia: "Jujuy" },
  { nombre: "Tilcara", provincia: "Jujuy" },

  // La Pampa
  { nombre: "Santa Rosa", provincia: "La Pampa" },
  { nombre: "General Pico", provincia: "La Pampa" },
  { nombre: "Toay", provincia: "La Pampa" },
  { nombre: "General Acha", provincia: "La Pampa" },
  { nombre: "Realicó", provincia: "La Pampa" },
  { nombre: "Victorica", provincia: "La Pampa" },
  { nombre: "Eduardo Castex", provincia: "La Pampa" },
  { nombre: "Macachín", provincia: "La Pampa" },
  { nombre: "Intendente Alvear", provincia: "La Pampa" },
  { nombre: "25 de Mayo", provincia: "La Pampa" },

  // La Rioja
  { nombre: "La Rioja", provincia: "La Rioja" },
  { nombre: "Chilecito", provincia: "La Rioja" },
  { nombre: "Aimogasta", provincia: "La Rioja" },
  { nombre: "Chamical", provincia: "La Rioja" },
  { nombre: "Chepes", provincia: "La Rioja" },

  // Mendoza
  { nombre: "Mendoza", provincia: "Mendoza" },
  { nombre: "Godoy Cruz", provincia: "Mendoza" },
  { nombre: "Guaymallén", provincia: "Mendoza" },
  { nombre: "Maipú", provincia: "Mendoza" },
  { nombre: "Luján de Cuyo", provincia: "Mendoza" },
  { nombre: "Las Heras", provincia: "Mendoza" },
  { nombre: "San Rafael", provincia: "Mendoza" },
  { nombre: "General Alvear", provincia: "Mendoza" },
  { nombre: "Malargüe", provincia: "Mendoza" },
  { nombre: "Tunuyán", provincia: "Mendoza" },
  { nombre: "San Martín", provincia: "Mendoza" },
  { nombre: "Rivadavia", provincia: "Mendoza" },

  // Misiones
  { nombre: "Posadas", provincia: "Misiones" },
  { nombre: "Oberá", provincia: "Misiones" },
  { nombre: "Eldorado", provincia: "Misiones" },
  { nombre: "Puerto Iguazú", provincia: "Misiones" },
  { nombre: "Apóstoles", provincia: "Misiones" },
  { nombre: "Leandro N. Alem", provincia: "Misiones" },
  { nombre: "Montecarlo", provincia: "Misiones" },
  { nombre: "Jardín América", provincia: "Misiones" },
  { nombre: "San Vicente", provincia: "Misiones" },

  // Neuquén
  { nombre: "Neuquén", provincia: "Neuquén" },
  { nombre: "Plottier", provincia: "Neuquén" },
  { nombre: "Centenario", provincia: "Neuquén" },
  { nombre: "Cutral Có", provincia: "Neuquén" },
  { nombre: "Plaza Huincul", provincia: "Neuquén" },
  { nombre: "Zapala", provincia: "Neuquén" },
  { nombre: "San Martín de los Andes", provincia: "Neuquén" },
  { nombre: "Junín de los Andes", provincia: "Neuquén" },
  { nombre: "Villa La Angostura", provincia: "Neuquén" },
  { nombre: "Chos Malal", provincia: "Neuquén" },
  { nombre: "Rincón de los Sauces", provincia: "Neuquén" },
  { nombre: "Aluminé", provincia: "Neuquén" },

  // Río Negro
  { nombre: "Viedma", provincia: "Río Negro" },
  { nombre: "San Carlos de Bariloche", provincia: "Río Negro" },
  { nombre: "General Roca", provincia: "Río Negro" },
  { nombre: "Cipolletti", provincia: "Río Negro" },
  { nombre: "Villa Regina", provincia: "Río Negro" },
  { nombre: "Allen", provincia: "Río Negro" },
  { nombre: "Cinco Saltos", provincia: "Río Negro" },
  { nombre: "Choele Choel", provincia: "Río Negro" },
  { nombre: "El Bolsón", provincia: "Río Negro" },
  { nombre: "Catriel", provincia: "Río Negro" },
  { nombre: "Río Colorado", provincia: "Río Negro" },
  { nombre: "Ingeniero Jacobacci", provincia: "Río Negro" },
  { nombre: "Las Grutas", provincia: "Río Negro" },
  { nombre: "Sierra Grande", provincia: "Río Negro" },

  // Salta
  { nombre: "Salta", provincia: "Salta" },
  { nombre: "San Ramón de la Nueva Orán", provincia: "Salta" },
  { nombre: "Tartagal", provincia: "Salta" },
  { nombre: "General Güemes", provincia: "Salta" },
  { nombre: "Rosario de la Frontera", provincia: "Salta" },
  { nombre: "Metán", provincia: "Salta" },
  { nombre: "Cafayate", provincia: "Salta" },
  { nombre: "Cerrillos", provincia: "Salta" },

  // San Juan
  { nombre: "San Juan", provincia: "San Juan" },
  { nombre: "Chimbas", provincia: "San Juan" },
  { nombre: "Rivadavia", provincia: "San Juan" },
  { nombre: "Santa Lucía", provincia: "San Juan" },
  { nombre: "Pocito", provincia: "San Juan" },
  { nombre: "Caucete", provincia: "San Juan" },
  { nombre: "Jáchal", provincia: "San Juan" },

  // San Luis
  { nombre: "San Luis", provincia: "San Luis" },
  { nombre: "Villa Mercedes", provincia: "San Luis" },
  { nombre: "Merlo", provincia: "San Luis" },
  { nombre: "La Punta", provincia: "San Luis" },
  { nombre: "Juana Koslay", provincia: "San Luis" },
  { nombre: "Justo Daract", provincia: "San Luis" },
  { nombre: "Concarán", provincia: "San Luis" },

  // Santa Cruz
  { nombre: "Río Gallegos", provincia: "Santa Cruz" },
  { nombre: "Caleta Olivia", provincia: "Santa Cruz" },
  { nombre: "El Calafate", provincia: "Santa Cruz" },
  { nombre: "Pico Truncado", provincia: "Santa Cruz" },
  { nombre: "Puerto Deseado", provincia: "Santa Cruz" },
  { nombre: "Las Heras", provincia: "Santa Cruz" },
  { nombre: "Río Turbio", provincia: "Santa Cruz" },
  { nombre: "Puerto San Julián", provincia: "Santa Cruz" },
  { nombre: "El Chaltén", provincia: "Santa Cruz" },
  { nombre: "Perito Moreno", provincia: "Santa Cruz" },

  // Santa Fe
  { nombre: "Rosario", provincia: "Santa Fe" },
  { nombre: "Santa Fe", provincia: "Santa Fe" },
  { nombre: "Rafaela", provincia: "Santa Fe" },
  { nombre: "Venado Tuerto", provincia: "Santa Fe" },
  { nombre: "Reconquista", provincia: "Santa Fe" },
  { nombre: "Villa Constitución", provincia: "Santa Fe" },
  { nombre: "San Lorenzo", provincia: "Santa Fe" },
  { nombre: "Esperanza", provincia: "Santa Fe" },
  { nombre: "Sunchales", provincia: "Santa Fe" },
  { nombre: "Cañada de Gómez", provincia: "Santa Fe" },
  { nombre: "Casilda", provincia: "Santa Fe" },
  { nombre: "Firmat", provincia: "Santa Fe" },
  { nombre: "Funes", provincia: "Santa Fe" },
  { nombre: "Granadero Baigorria", provincia: "Santa Fe" },
  { nombre: "Villa Gobernador Gálvez", provincia: "Santa Fe" },

  // Santiago del Estero
  { nombre: "Santiago del Estero", provincia: "Santiago del Estero" },
  { nombre: "La Banda", provincia: "Santiago del Estero" },
  { nombre: "Termas de Río Hondo", provincia: "Santiago del Estero" },
  { nombre: "Añatuya", provincia: "Santiago del Estero" },
  { nombre: "Frías", provincia: "Santiago del Estero" },
  { nombre: "Fernández", provincia: "Santiago del Estero" },
  { nombre: "Quimilí", provincia: "Santiago del Estero" },

  // Tierra del Fuego
  { nombre: "Ushuaia", provincia: "Tierra del Fuego" },
  { nombre: "Río Grande", provincia: "Tierra del Fuego" },
  { nombre: "Tolhuin", provincia: "Tierra del Fuego" },

  // Tucumán
  { nombre: "San Miguel de Tucumán", provincia: "Tucumán" },
  { nombre: "Yerba Buena", provincia: "Tucumán" },
  { nombre: "Tafí Viejo", provincia: "Tucumán" },
  { nombre: "Concepción", provincia: "Tucumán" },
  { nombre: "Aguilares", provincia: "Tucumán" },
  { nombre: "Banda del Río Salí", provincia: "Tucumán" },
  { nombre: "Monteros", provincia: "Tucumán" },
  { nombre: "Tafí del Valle", provincia: "Tucumán" },
];

/** Cómo se guarda y se muestra una localidad: "Bahía Blanca, Buenos Aires".
 *  La provincia va pegada porque hay nombres repetidos (Merlo, Mercedes,
 *  Rivadavia) y porque el pie de portada del informe la usa para ubicar a la
 *  empresa. Cuando el nombre ya es el de la provincia (CABA) no se repite. */
export function etiquetaLocalidad(localidad: Localidad): string {
  return localidad.nombre === localidad.provincia
    ? localidad.nombre
    : `${localidad.nombre}, ${localidad.provincia}`;
}

/** El catálogo alfabético, que es como espera verlo alguien que abre el combo
 *  sin tipear nada. */
export const LOCALIDADES: readonly Localidad[] = [...CATALOGO].sort((a, b) =>
  etiquetaLocalidad(a).localeCompare(etiquetaLocalidad(b), "es"),
);

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
