import { z } from "zod";

/** Esquema de lo que devuelve Claude. Es el contrato: si la respuesta no
 *  valida contra esto, no se guarda.
 *
 *  La forma sigue la auditoría de referencia (docs/auditoria-ejemplo.html desde
 *  analysis-2.0.0; antes, docs/ejemplo-auditoria-audifarm.pdf), que NO se
 *  organiza en pilares sino en canales, y que arranca por lo que la empresa
 *  YA tiene antes de decir qué le falta. Un solo pilar: Arquitectura digital.
 *  Los bloques de cada lámina están al final del archivo.
 *
 *  Desde analysis-1.8.0 hay un segundo grupo de bloques —seo, google_ads,
 *  meta_ads, mapa_sector, ficha_google y redes— que salen de la BÚSQUEDA WEB
 *  que hace el modelo, no de los facts del sitio. Son todos opcionales: en
 *  modo mock, sin búsqueda habilitada o cuando la búsqueda no alcanzó para
 *  afirmar nada, no vienen, y un results viejo sigue parseando igual. Lo que
 *  no se pudo verificar se marca "a_validar"; nunca se rellena. */

export const estadoCanal = z.enum([
  "activo",
  "parcial",
  "ausente",
  "fallas_criticas",
  /** Reservado para un solo caso: el sitio no se pudo leer, así que el canal
   *  no se pudo mirar. NO es "no lo analizamos en esta versión" —eso se omite—
   *  ni es ausencia: decir "ausente" cuando no pudimos verificar sería la
   *  acusación falsa que las reglas duras prohíben. */
  "a_validar",
]);

const check = z.object({
  tipo: z.enum(["error", "alerta", "ok"]),
  titulo: z.string(),
  detalle: z.string(),
});

const canal = z.object({
  /** 1 a 5, la escala de la auditoría: cinco = profesional y sostenido,
   *  uno = no existe o está roto. Alimenta el score y los puntos del resumen. */
  madurez: z.number().int().min(1).max(5),
  estado: estadoCanal,
  insight: z.string(),
  checks: z.array(check).max(6),
});

/** Un dato duro con su etiqueta: el "64.800 / seguidores en Instagram" de la
 *  auditoría. `dato` es lo que va grande, así que tiene que ser corto. */
const numeroDestacado = z.object({
  dato: z.string().max(24),
  etiqueta: z.string(),
});

/* ---------- Piezas de las láminas (analysis-2.0.0) ---------- */

/** Los topes de largo de las láminas. El informe sigue el deck
 *  docs/auditoria-ejemplo.html, que es 16:9 fijo: un texto que no entra se
 *  corta. Por eso el largo se valida acá y no se confía en el prompt. Los
 *  topes salen de medir el ejemplo y darle un margen. */

/** Margen sobre los topes. Los topes miden lo que entra en la lámina con
 *  aire de sobra; el modelo cuenta caracteres mal y se pasa por poco. Rechazar
 *  una respuesta por 3 caracteres tiraba un análisis entero (~USD 4 de
 *  búsquedas). El prompt pide el tope nominal; el esquema rechaza recién
 *  pasado este margen. */
export const TOLERANCIA_TOPES = 1.3;

/** Un texto con tope de lámina (con el margen de arriba). */
const texto = (maximo: number) => z.string().max(Math.ceil(maximo * TOLERANCIA_TOPES));

/** El título de una lámina: el hallazgo, no el nombre de la sección. */
const titulo = texto(125);
/** La banda "Conclusión" que cierra cada lámina. */
const conclusion = texto(250);
/** La nota gris de fuente o de lectura, debajo del contenido. */
const nota = texto(280);

/** Una barra de los gráficos: quién y cuánto. `valor` es texto porque se
 *  copia tal como se vio ("9", "~35", "41K"); null = no se pudo ver, y la
 *  barra se dibuja como "a validar", nunca como cero. */
const barra = z.object({
  nombre: texto(32),
  valor: texto(12).nullish(),
  /** true = es la empresa diagnosticada: su barra va en otro color. */
  propio: z.boolean().optional().default(false),
});

/** La fila de una empresa en la tabla del mapa del sector. */
const celdasSector = z.object({
  google_ads: texto(26),
  meta_ads: texto(26),
  instagram: texto(18),
  ficha: texto(22),
  sitio: texto(110),
});

/* ---------- Investigación externa (sale de web_search) ---------- */

/** Qué tan firme es un dato que salió de la búsqueda web.
 *  - verificado: la búsqueda lo devolvió y hay al menos una fuente.
 *  - no_concluyente: se buscó y lo que volvió no alcanza para afirmarlo.
 *  - a_validar: no se pudo mirar (no es público, la búsqueda no alcanzó). */
export const estadoExterno = z.enum(["verificado", "no_concluyente", "a_validar"]);

/** Regla dura, chequeada por código y no por confianza: un dato externo
 *  "verificado" tiene que traer la URL que lo respalda. Si el modelo afirma
 *  algo sin fuente, el esquema no valida y se le devuelve el error para que
 *  corrija (ver el reintento en analyze.ts). */
const conFuente = <T extends { estado: "verificado" | "no_concluyente" | "a_validar"; fuentes: string[] }>(
  valor: T,
) => valor.estado !== "verificado" || valor.fuentes.length > 0;

const MENSAJE_SIN_FUENTE = "un dato 'verificado' necesita al menos una fuente (URL de la búsqueda)";

const fuentes = z.array(z.string()).max(4).optional().default([]);

/** Un hallazgo externo suelto: qué se encontró, con qué firmeza y dónde. */
const hallazgoExterno = z
  .object({
    estado: estadoExterno,
    detalle: z.string(),
    fuentes,
  })
  .refine(conFuente, { message: MENSAJE_SIN_FUENTE });

/** Una búsqueda del comprador (rubro + zona, producto + ciudad), NUNCA la
 *  marca: la gracia es ver si aparece cuando la buscan por lo que vende. */
const ranking = z.object({
  keyword: texto(80),
  aparece: z.enum(["si", "no", "no_concluyente"]),
  /** En palabras ("entre los primeros resultados"), no un puesto inventado. */
  posicion: texto(60).nullish(),
  /** Quién ocupa esos lugares hoy. */
  ocupan: z.array(texto(80)).max(5).optional().default([]),
  /** En qué columna de la lámina de Google orgánico va (analysis-2.0.0):
   *  "a" = la búsqueda donde la empresa ya juega (por lo general, el producto
   *  o la marca que vende), "b" = la que todavía no captura (zona, uso, tipo
   *  de proveedor). Los títulos de las dos columnas están en `seo`. */
  grupo: z.enum(["a", "b"]).nullish(),
  fuentes,
});

const competidor = z.object({
  nombre: texto(80),
  sitio: texto(200).nullish(),
  /** declarado = lo cargó la empresa en el formulario; detectado = lo
   *  encontró la búsqueda. Sirve para saber de quién es el recorte. */
  origen: z.enum(["declarado", "detectado"]),
  /** Por qué compite de verdad (mismo rubro, misma zona, mismo comprador).
   *  Si no se puede sostener, el competidor no va. */
  por_que_compite: z.string(),
  /** Lo relevable por competidor, para la tabla del mapa del sector. */
  busquedas: hallazgoExterno.nullish(),
  pauta: hallazgoExterno.nullish(),
  redes: hallazgoExterno.nullish(),
  ficha_google: hallazgoExterno.nullish(),
  /** Las cifras públicas del competidor para las barras de la lámina de redes
   *  y ficha (analysis-2.0.0). Como texto y tal como se vieron ("41K",
   *  "4,1"); null = no se vio. El código las pasa a número para dibujar. */
  instagram: texto(12).nullish(),
  rating: texto(6).nullish(),
  resenas: texto(10).nullish(),
  /** Su fila en la tabla del mapa del sector, ya resumida. */
  celdas: celdasSector.nullish(),
  /** Las fuentes de nivel competidor: de dónde salió que existe y que compite. */
  fuentes,
});

/** Una página interna del sitio, leída por búsqueda (no por navegador): lo
 *  que Google indexó de ella —su título y su descripción tal como se ven en
 *  los resultados— más lo que se desprende de eso. Es evidencia de cómo se
 *  presenta cada página, no del HTML renderizado: lo que carga por JavaScript
 *  sigue sin poder verificarse por esta vía. */
const paginaInterna = z
  .object({
    url: texto(300),
    /** El título tal como lo muestra el buscador. null = no se pudo leer. */
    titulo: texto(200).nullish(),
    /** La descripción que muestra el buscador. null = no tiene o no se leyó. */
    descripcion: texto(400).nullish(),
    /** Qué dice esa página de cómo está armado el sitio: título automático o
     *  genérico, ficha que solo repite el nombre del producto, página sin
     *  descripción, sección pensada para el comprador o para la empresa. */
    hallazgo: z.string(),
    estado: estadoExterno,
    fuentes,
  })
  .refine(conFuente, { message: MENSAJE_SIN_FUENTE });

/** Pauta publicitaria de un canal. `actividad` es lo que se puede afirmar;
 *  "sin_actividad_visible" NO es "no pauta": es que la herramienta pública no
 *  mostró anuncios. El texto lo tiene que decir así. */
const canalPauta = z
  .object({
    estado: estadoExterno,
    actividad: z.enum(["activa", "sin_actividad_visible", "desconocida"]),
    hallazgo: z.string(),
    /* Desde analysis-2.0.0, lo que llena la lámina del canal. Todo opcional:
     * sin esto la lámina no se dibuja, y un informe viejo sigue parseando. */
    titulo: titulo.nullish(),
    /** Primer gráfico: la empresa y sus competidores, con cuántos anuncios
     *  les mostró la herramienta pública. */
    comparativa_titulo: texto(110).nullish(),
    comparativa: z.array(barra).max(5).nullish(),
    /** Segundo gráfico (Google): quién SÍ aparece pautando en las búsquedas
     *  del comprador, aunque no sea uno de los competidores comparados. */
    anunciantes_titulo: texto(130).nullish(),
    anunciantes: z.array(barra).max(8).nullish(),
    /** Meta: a dónde lleva el clic de cada uno ("Novecento: 21 → WhatsApp"). */
    destinos: z.array(texto(80)).max(5).nullish(),
    /** Meta: el recuadro que explica qué pasa después del clic. */
    explicacion: z.object({ titulo: texto(70), texto: texto(340) }).nullish(),
    nota: nota.nullish(),
    conclusion: conclusion.nullish(),
    fuentes,
  })
  .refine(conFuente, { message: MENSAJE_SIN_FUENTE });

/** Lo que existía antes de analysis-2.0.0, sin topes nuevos: es la base de
 *  los dos contratos (el de generación y el de lectura, ver abajo). */
const analysisBase = z.object({
  /** Portada: la tesis en dos golpes, como "Google ya te manda la consulta. /
   *  El problema es dónde cae." */
  tesis: z.object({
    titular: z.string(),
    bajada: z.string(),
  }),

  resumen: z.string(),

  /** "Lo que ya tienen": se abre por lo que existe, no por lo que falta. Puede
   *  venir vacío —un sitio roto no tiene activos que mostrar— y en ese caso la
   *  sección no se dibuja. Nunca se rellena para que quede lindo. */
  activos: z.array(numeroDestacado).max(6),

  /** "El recorrido": los pasos del comprador hasta que se va. Cada paso tiene
   *  que apoyarse en un fact; lo que no sabemos (si llega por Google, con qué
   *  búsqueda) no se narra. */
  recorrido: z.array(
    z.object({
      paso: texto(20),
      detalle: z.string(),
    }),
  ).min(3).max(4),

  canales: z.object({
    sitio: canal,
    contacto: canal,
    /** El orden del sitio: cómo lo piensa la empresa vs. cómo busca el
     *  comprador. Se llama "orden" y no "arquitectura" para no chocar con el
     *  nombre del pilar. */
    orden: canal,
    busqueda: canal,
    /** Incluye la protección del correo (DMARC), como en la auditoría. */
    medicion: canal,
  }),

  fugas: z
    .array(
      z.object({
        titulo: z.string(),
        que_se_pierde: z.string(),
      }),
    )
    .min(1)
    .max(3),

  /** El Método Qualita. Desde analysis-2.0.0 son siempre los 6 pasos, en el
   *  orden fijo del método: el título lo pone el sistema y el modelo escribe
   *  el detalle. `titulo` se sigue pidiendo para la consola. */
  plan: z
    .array(
      z.object({
        titulo: z.string(),
        detalle: z.string(),
      }),
    )
    .min(4)
    .max(6),

  /** "En números": el titular de cierre. Los números de esa lámina los calcula
   *  el código desde los facts (lib/diagnostico/hechos.ts), así que ya no se le
   *  piden al modelo (analysis-1.3.0). `numeros` sigue aceptándose para que los
   *  informes viejos y el mock parseen; no se muestra. */
  cierre: z.object({
    titular: z.string(),
    numeros: z.array(numeroDestacado).max(6).optional().default([]),
  }),

  /* ---------- Todo lo de acá abajo sale de la búsqueda web ---------- */

  /** Posiciones en Google Argentina para las búsquedas del comprador. OJO:
   *  no confundir con `facts.seo`, que son las señales on-page del sitio. */
  seo: z
    .object({
      rankings: z.array(ranking).max(12).optional().default([]),
      /** Qué se lee de esas posiciones, en una o dos frases. */
      lectura: z.string().nullish(),
      /* La lámina de Google orgánico (analysis-2.0.0). */
      titulo: titulo.nullish(),
      /** Los títulos de las dos columnas: dónde ya juega y dónde no. */
      grupo_a: texto(40).nullish(),
      grupo_b: texto(46).nullish(),
      nota: nota.nullish(),
      conclusion: conclusion.nullish(),
    })
    .nullish(),

  /** Pauta en Google. "activa" solo con evidencia pública (Centro de
   *  Transparencia de Anuncios); nunca con conteos ni presupuestos. */
  google_ads: canalPauta.nullish(),
  /** Pauta en Meta (Biblioteca de Anuncios), con la misma vara. */
  meta_ads: canalPauta.nullish(),

  /** "Dónde está la vara del mercado": un competidor por fila. */
  mapa_sector: z.array(competidor).max(5).nullish(),

  /** La ficha del negocio en Google, con lo público (rating, reseñas, rubro). */
  ficha_google: z
    .object({
      estado: estadoExterno,
      /** Como texto ("4,6"): un número obliga a una precisión que no tenemos. */
      rating: texto(10).nullish(),
      resenas: texto(16).nullish(),
      categoria: texto(80).nullish(),
      detalle: z.string(),
      fuentes,
    })
    .refine(conFuente, { message: MENSAJE_SIN_FUENTE })
    .nullish(),

  /** Cómo está ordenado el sitio según lo que se leyó de sus páginas, contra
   *  cómo busca el comprador. Es el análisis de arquitectura de la
   *  metodología, hecho con lo indexado. NO cambia la madurez del canal
   *  "orden", que se sigue puntuando solo con los facts. */
  arquitectura: z
    .object({
      estado: estadoExterno,
      /** La lógica que usa el sitio hoy (por división interna, por producto,
       *  por zona, por tipo de cliente). */
      como_esta_ordenado: z.string(),
      /** Con qué lógica llega el comprador, según lo que devolvieron las
       *  búsquedas del rubro. */
      como_busca_el_comprador: z.string(),
      /** Dónde no coinciden las dos, y qué se pierde ahí. */
      brecha: z.string(),
      fuentes,
    })
    .refine(conFuente, { message: MENSAJE_SIN_FUENTE })
    .nullish(),

  /** Las páginas internas que se pudieron leer, una por entrada. Vacío o
   *  ausente = no se leyó ninguna; nunca se completa de memoria. */
  paginas: z.array(paginaInterna).max(10).nullish(),

  /** Perfiles públicos de la empresa. Seguidores y actividad como texto, y
   *  solo si la búsqueda los devolvió. */
  redes: z
    .array(
      z
        .object({
          red: texto(20),
          perfil: texto(200).nullish(),
          seguidores: texto(16).nullish(),
          actividad: z.string().nullish(),
          estado: estadoExterno,
          fuentes,
        })
        .refine(conFuente, { message: MENSAJE_SIN_FUENTE }),
    )
    .max(6)
    .nullish(),
});

/* ================================================================== */
/* Las láminas del informe (analysis-2.0.0)                            */
/* ================================================================== */

/** El informe sigue lámina por lámina docs/auditoria-ejemplo.html. Cada
 *  bloque de acá abajo es el contenido de UNA lámina —título, lo de adentro y
 *  su "Conclusión"—; el kicker, el pie y el orden los pone el sistema.
 *
 *  Los que dependen de algo que puede no existir (un formulario que comparar,
 *  un modelo de sitio que choca con cómo se compra, una lectura de páginas)
 *  son opcionales: sin eso la lámina no se dibuja. Un bloque vacío no se
 *  rellena. */

/** Lámina "La pregunta que ordena": la escena del comprador. Los pasos son
 *  `recorrido`; esto es lo que los rodea. */
const escena = z.object({
  /** El título de la lámina: la persona y su problema, terminando en la
   *  pregunta. "Un arquitecto tiene que resolver... ¿Qué pasa cuando llega al
   *  sitio?" */
  pregunta: texto(130),
  /** Qué necesita, en una línea: la bajada en itálica. */
  necesidad: texto(175),
  /** Una cita pública que confirme la escena (una reseña visible en la ficha
   *  de Google, por ejemplo). Solo con la URL de donde salió. */
  cita: z
    .object({
      texto: texto(170),
      /** De dónde es, para mostrar debajo ("reseña en la ficha de Google"). */
      origen: texto(80),
      fuentes: z.array(z.string()).min(1).max(2),
    })
    .nullish(),
  conclusion,
});

/** Lámina "Sitio web · Cómo aparece en Google": el título que tiene hoy
 *  cada página contra el que debería tener. */
const titulos = z.object({
  titulo,
  bajada: texto(230),
  filas: z
    .array(
      z.object({
        /** Qué página es ("Home", "Categoría Dekton", "Ficha de producto"). */
        pagina: texto(28),
        /** El título real, copiado: de los facts (home) o de lo leído. */
        hoy: texto(95),
        /** El que proponemos: material, uso y ciudad, en vez del automático. */
        deberia: texto(105),
      }),
    )
    .min(1)
    .max(4),
  nota: nota.nullish(),
  conclusion,
});

/** Lámina "Sitio web · Home": lo que ve quien entra y lo que queda escondido. */
const home = z.object({
  titulo,
  /** Lo que se ve al entrar, en viñetas cortas. */
  ve_quien_entra: z.array(texto(115)).min(2).max(5),
  /** Un segundo bloque de viñetas en el mismo panel, para problemas
   *  concretos verificados (un link que devolvió error al leerlo, un texto
   *  roto). Sin nada verificado, no va. */
  a_corregir: z
    .object({
      titulo: texto(40),
      items: z.array(texto(135)).min(1).max(3),
    })
    .nullish(),
  /** Los argumentos de venta que existen pero no están en la home, con la
   *  página donde sí están. */
  escondido: z
    .object({
      /** "/sobre-nosotros" */
      donde: texto(40),
      datos: z.array(z.object({ dato: texto(14), etiqueta: texto(40) })).min(1).max(4),
    })
    .nullish(),
  conclusion,
});

/** Lámina "Sitio web · Modelo": la mecánica del sitio contra cómo compra el
 *  cliente de verdad. Solo cuando chocan. */
const modelo = z.object({
  titulo,
  /** "Lo que tiene el sitio (mecánica de tienda)" */
  mecanica_titulo: texto(60),
  mecanica: z
    .array(z.object({ k: texto(40), v: texto(95) }))
    .min(2)
    .max(5),
  /** "Cómo compra en realidad el cliente", en pasos. */
  compra_real: z.array(texto(70)).min(3).max(4),
  nota: nota.nullish(),
  conclusion,
});

/** Un formulario, campo por campo, para la lámina de captación. */
const formularioComparado = z.object({
  /** "Eurostone · /presupuesto" */
  etiqueta: texto(60),
  campos: z
    .array(
      z.object({
        texto: texto(42),
        /** Del lado de la empresa: el campo que FALTA (se pinta de coral).
         *  Del lado del competidor: el campo que CALIFICA la consulta. */
        destacado: z.boolean(),
      }),
    )
    .min(1)
    .max(8),
  nota: texto(240),
});

/** Lámina "Sitio web · Captación": el formulario de la empresa contra el de
 *  un competidor. Los campos salen de `leer_pagina`, no de la búsqueda. */
const captacion = z.object({
  titulo,
  propio: formularioComparado,
  competidor: formularioComparado.nullish(),
  conclusion,
});

/** Lámina "Arquitectura": las lógicas con las que se puede ordenar el sitio
 *  (por material, por zona, por uso) y si cada una existe. */
const estructura = z.object({
  titulo,
  ejes: z
    .array(
      z.object({
        /** "Por material" */
        eje: texto(28),
        /** si = existe y funciona; parcial = existe a medias; no = no la
         *  encontramos (nunca "no existe" si no se pudo leer todo). */
        tiene: z.enum(["si", "parcial", "no"]),
        /** "Existe y rankea", "No la encontramos" */
        estado: texto(28),
        items: z.array(texto(95)).min(1).max(5),
      }),
    )
    .min(2)
    .max(3),
  conclusion,
});

/** Lámina "Redes y ficha de Google". Las barras salen de `redes`,
 *  `ficha_google` y `mapa_sector`; esto es lo que las rodea. */
const redesFicha = z.object({
  titulo,
  nota: nota.nullish(),
  conclusion,
});

/** Lámina "Medición": la tabla la arma el código con los facts de la empresa
 *  y lo que leyó `leer_pagina` de cada competidor. El modelo escribe esto. */
const medicionDeck = z.object({
  titulo,
  nota: nota.nullish(),
  conclusion,
});

/** Lámina "Mapa del sector": las filas de los competidores están en
 *  `mapa_sector[].celdas`; esto es la fila de la empresa y la lectura. */
const sector = z.object({
  titulo,
  propio: celdasSector,
  urgencia: texto(300),
  oportunidad: texto(300),
  conclusion,
});

/** Un canal del score que sale de la búsqueda. madurez null = no se pudo
 *  mirar: no entra al score y se muestra "a validar", nunca como 1. */
const canalScoreExterno = z.object({
  madurez: z.number().int().min(1).max(5).nullable(),
  detalle: texto(115),
});

/** Lámina "Score por canal": los seis canales del ejemplo. Sitio web y
 *  Medición NO traen madurez: la calcula el código con la rúbrica de los
 *  canales del sitio (ver score.ts). */
const scoreCanales = z.object({
  google_organico: canalScoreExterno,
  redes_ficha: canalScoreExterno,
  sitio: z.object({ detalle: texto(115) }),
  google_ads: canalScoreExterno,
  meta_ads: canalScoreExterno,
  medicion: z.object({ detalle: texto(115) }),
  conclusion,
});

/** Lámina "Síntesis": tres columnas. */
const sintesis = z.object({
  titulo,
  tiene: z.array(texto(90)).min(1).max(4),
  falta: z.array(texto(90)).min(1).max(4),
  oportunidad: z.array(texto(145)).min(1).max(4),
  conclusion,
});

/** Las conclusiones de las láminas con título fijo, y lo que queda a validar
 *  con el cliente en la nota de método. */
const conclusiones = z.object({
  alcance: conclusion,
  punto_de_partida: conclusion,
  metodo: conclusion,
  nota_metodo: conclusion,
  /** Lo que queda por validar con accesos del cliente, en un párrafo. */
  a_validar: texto(430),
});

/** Los bloques de las láminas, con lo que es obligatorio al GENERAR. */
const bloquesDeck = {
  escena,
  conclusiones,
  score_canales: scoreCanales,
  sintesis,
  titulos: titulos.nullish(),
  home: home.nullish(),
  modelo: modelo.nullish(),
  captacion: captacion.nullish(),
  estructura: estructura.nullish(),
  redes_ficha: redesFicha.nullish(),
  medicion_deck: medicionDeck.nullish(),
  sector: sector.nullish(),
};

/** Topes de los campos que ya existían antes de 2.0.0. No van en la base
 *  porque un informe viejo con un texto más largo dejaría de parsear; se
 *  exigen solo a lo que se genera ahora. */
function topesDeLamina(salida: z.infer<typeof analysisBase>, ctx: z.RefinementCtx): void {
  const tope = (valor: string, maximo: number, path: (string | number)[]) => {
    if (valor.length > Math.ceil(maximo * TOLERANCIA_TOPES)) {
      ctx.addIssue({
        code: "custom",
        path,
        message: `tiene ${valor.length} caracteres y el máximo es ${maximo} (la lámina es de tamaño fijo)`,
      });
    }
  };

  tope(salida.tesis.titular, 60, ["tesis", "titular"]);
  tope(salida.tesis.bajada, 110, ["tesis", "bajada"]);
  salida.activos.forEach((activo, i) => {
    tope(activo.dato, 14, ["activos", i, "dato"]);
    tope(activo.etiqueta, 95, ["activos", i, "etiqueta"]);
  });
  salida.recorrido.forEach((paso, i) => tope(paso.detalle, 150, ["recorrido", i, "detalle"]));
  salida.plan.forEach((paso, i) => tope(paso.detalle, 115, ["plan", i, "detalle"]));

  if (salida.plan.length !== 6) {
    ctx.addIssue({
      code: "custom",
      path: ["plan"],
      message: `tiene ${salida.plan.length} pasos y el Método Qualita tiene 6, en su orden`,
    });
  }
}

/** El contrato de GENERACIÓN: lo que tiene que devolver el análisis hoy. Si
 *  la respuesta no valida contra esto, no se guarda. */
export const analysisOutput = analysisBase.extend(bloquesDeck).superRefine(topesDeLamina);

/** El contrato de LECTURA: acepta los informes de antes de analysis-2.0.0,
 *  que no traen los bloques de las láminas. Lo usa lib/diagnostico/results.ts. */
export const analysisLectura = analysisBase.extend({
  escena: escena.nullish(),
  conclusiones: conclusiones.nullish(),
  score_canales: scoreCanales.nullish(),
  sintesis: sintesis.nullish(),
  titulos: titulos.nullish(),
  home: home.nullish(),
  modelo: modelo.nullish(),
  captacion: captacion.nullish(),
  estructura: estructura.nullish(),
  redes_ficha: redesFicha.nullish(),
  medicion_deck: medicionDeck.nullish(),
  sector: sector.nullish(),
});

export type AnalysisOutput = z.infer<typeof analysisOutput>;
export type Canal = z.infer<typeof canal>;
export type EstadoExterno = z.infer<typeof estadoExterno>;
export type Competidor = z.infer<typeof competidor>;
export type PaginaInterna = z.infer<typeof paginaInterna>;
export type Ranking = z.infer<typeof ranking>;
export type HallazgoExterno = z.infer<typeof hallazgoExterno>;
export type AnalysisLectura = z.infer<typeof analysisLectura>;
export type ScoreCanales = z.infer<typeof scoreCanales>;

/** Las claves de canal en el orden en que se muestran, con su rótulo. El orden
 *  es el del recorrido: llega al sitio, busca cómo contactar, el sitio está (o
 *  no) ordenado, Google lo encuentra (o no), y nada de eso se mide. */
export const CANALES = [
  ["sitio", "Sitio web"],
  ["contacto", "Vías de contacto"],
  ["orden", "Cómo está ordenado el sitio"],
  ["busqueda", "Qué ve Google"],
  ["medicion", "Medición"],
] as const;

export type ClaveCanal = (typeof CANALES)[number][0];
