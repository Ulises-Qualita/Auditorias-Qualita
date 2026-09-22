import "server-only";

import type { SiteFacts } from "./collect";
import type { CompanyForAnalysis } from "./prompt";
import type { AnalysisOutput } from "./schema";
import { computeScores } from "./score";

/** Generador MOCK del análisis. Reemplaza SOLO la llamada a Claude: la salida
 *  se valida contra el mismo `analysisOutput` y pasa por el mismo scoring que
 *  en modo live. Sirve para ejercitar el pipeline entero (collect → parse →
 *  score → guardado → polling) sin gastar la ANTHROPIC_API_KEY.
 *
 *  Regla de oro: todo lo que dice el mock se DERIVA de los facts reales. Si un
 *  hallazgo no está en los facts, no aparece acá tampoco. */

export const MOCK_ANALYSIS_VERSION = "analysis-mock-3.0.0";

type Check = AnalysisOutput["canales"]["sitio"]["checks"][number];
type Canal = AnalysisOutput["canales"]["sitio"];
type Numero = AnalysisOutput["activos"][number];
type Fuga = AnalysisOutput["fugas"][number];

/** Títulos que no dicen nada del negocio: los tratamos como "genérico". */
const TITLES_GENERICOS =
  /^(home|inicio|index|untitled|sitio web|mi sitio|nuevo sitio|welcome|bienvenidos?)\b/i;

export function buildMockOutput(
  company: CompanyForAnalysis,
  facts: SiteFacts,
): AnalysisOutput {
  const fugas: Fuga[] = [];

  const medicion = evaluarMedicion(facts, fugas);
  const sitio = evaluarSitio(facts, fugas);
  const busqueda = evaluarSeo(facts, fugas);
  const contacto = evaluarContacto(facts, fugas);
  const orden = evaluarOrden(facts, fugas);
  const canales = { sitio, contacto, orden, busqueda, medicion };

  const activos = armarActivos(facts);
  const fugasFinales = recortarFugas(fugas);
  const plan = armarPlan(canales);

  return {
    tesis: armarTesis(company, facts, canales),
    resumen: armarResumen(company, facts, canales),
    activos,
    recorrido: armarRecorrido(facts),
    canales,
    fugas: fugasFinales,
    plan,
    cierre: armarCierre(company, facts, canales),
    // Las láminas de 2.0.0. El mock no busca ni lee páginas: solo arma lo que
    // sale de los facts, y lo demás no se dibuja.
    escena: armarEscena(company, facts),
    conclusiones: armarConclusiones(company),
    score_canales: armarScoreCanales(canales),
    sintesis: armarSintesis(company, activos, fugasFinales, plan),
    captacion: armarCaptacion(company, facts),
  };
}

/* ------------------------------------------------------------------ medición */

function evaluarMedicion(facts: SiteFacts, fugas: Fuga[]): Canal {
  const t = facts.tracking;
  const checks: Check[] = [];

  if (!t) {
    // Sin HTML no hay nada que afirmar: no es ausencia, es no verificado.
    checks.push({
      tipo: "alerta",
      titulo: "Medición sin verificar",
      detalle:
        "No se pudo leer el HTML del sitio, así que no hay evidencia sobre GA4, GTM ni píxel. Queda a validar con accesos.",
    });
    agregarChecksDmarc(facts, checks);
    return {
      madurez: 1,
      estado: "a_validar",
      insight:
        "No pudimos confirmar si estás midiendo. Sin eso, cualquier inversión en pauta se evalúa a ciegas.",
      checks: recortarChecks(checks),
    };
  }

  const canales: Array<[boolean, string, string]> = [
    [
      t.ga4,
      "GA4",
      "No se detectó Google Analytics 4: no hay registro de qué hace la gente en el sitio.",
    ],
    [
      t.gtm,
      "Google Tag Manager",
      "No se detectó GTM: cada etiqueta nueva hay que tocarla en el código.",
    ],
    [
      t.metaPixel,
      "Píxel de Meta",
      "No se detectó el píxel de Meta: no se puede hacer remarketing ni medir conversiones desde Instagram o Facebook.",
    ],
    [
      t.googleAdsConversion,
      "Conversión de Google Ads",
      "No se detectó etiqueta de conversión de Google Ads: si hay pauta, no se sabe qué clic terminó en consulta.",
    ],
  ];

  if (!t.algunTagPresente) {
    for (const [, nombre, detalle] of canales) {
      checks.push({ tipo: "error", titulo: `${nombre} ausente`, detalle });
    }
    checks.push({
      tipo: "alerta",
      titulo: "Podrían cargar por JavaScript",
      detalle:
        "Los tags se buscaron en el HTML inicial. Existe la chance de que carguen por JS después; confirmarlo requiere acceso de solo lectura.",
    });
    agregarChecksDmarc(facts, checks);
    fugas.push({
      titulo: "No sabés de dónde viene cada consulta",
      que_se_pierde:
        "Sin GA4 ni etiquetas de conversión, no hay forma de saber qué canal trae clientes. El presupuesto se decide por intuición.",
    });
    return {
      madurez: 1,
      estado: "ausente",
      insight:
        "No detectamos ninguna herramienta de medición en tu sitio. Hoy no podés saber cuánta gente entra, de dónde viene ni qué termina en consulta.",
      checks: recortarChecks(checks),
    };
  }

  let presentes = 0;
  for (const [presente, nombre, detalle] of canales) {
    if (presente) {
      presentes += 1;
      checks.push({
        tipo: "ok",
        titulo: `Detectamos ${nombre}`,
        detalle: `Se encontró ${nombre} en el HTML del sitio.`,
      });
    } else {
      checks.push({ tipo: "alerta", titulo: `No detectamos ${nombre}`, detalle });
    }
  }

  if (t.universalAnalyticsLegacy) {
    checks.push({
      tipo: "error",
      titulo: "Universal Analytics todavía instalado",
      detalle:
        "Quedó código de la versión vieja de Analytics, que ya no recolecta datos. Es peso muerto que ensucia la medición.",
    });
  }

  agregarChecksDmarc(facts, checks);

  const madurez = presentes >= 3 ? 5 : presentes === 2 ? 4 : 3;

  if (madurez < 5) {
    fugas.push({
      titulo: "Medís a medias",
      que_se_pierde:
        "Tenés parte del stack de medición, pero faltan piezas: hay tramos del recorrido del comprador que no quedan registrados.",
    });
  }

  return {
    madurez,
    estado: t.ga4 && presentes >= 2 ? "activo" : "parcial",
    insight:
      presentes >= 3
        ? "Tenés medición instalada y funcionando. El paso siguiente es usarla para decidir, no solo para mirarla."
        : "Estás midiendo, pero a medias. Completar el stack te deja ver el recorrido entero y no pedazos sueltos.",
    checks: recortarChecks(checks),
  };
}

function agregarChecksDmarc(facts: SiteFacts, checks: Check[]): void {
  const d = facts.dmarc;
  if (!d) return;

  if (d.exists === null) {
    checks.push({
      tipo: "alerta",
      titulo: "DMARC sin verificar",
      detalle: `No se pudo consultar el DMARC de ${d.domain}${d.error ? ` (${d.error})` : ""}. Queda a validar.`,
    });
    return;
  }
  if (!d.exists) {
    checks.push({
      tipo: "error",
      titulo: "Sin registro DMARC",
      detalle: `El dominio ${d.domain} no tiene DMARC: tus mails pueden caer en spam y cualquiera puede falsificar tu remitente.`,
    });
    return;
  }
  if (d.policy === "none") {
    checks.push({
      tipo: "alerta",
      titulo: "DMARC en modo observación",
      detalle: `${d.domain} tiene DMARC con política "none": registra, pero no bloquea a quien falsifique tu dominio.`,
    });
    return;
  }
  checks.push({
    tipo: "ok",
    titulo: "DMARC configurado",
    detalle: `${d.domain} tiene DMARC con política "${d.policy}".`,
  });
}

/* --------------------------------------------------------------------- sitio */

function evaluarSitio(facts: SiteFacts, fugas: Fuga[]): Canal {
  const checks: Check[] = [];

  if (!facts.fetch.ok || !facts.seo) {
    checks.push({
      tipo: "error",
      titulo: "El sitio no respondió",
      detalle: `No se pudo descargar ${facts.inputUrl ?? "el sitio"}: ${facts.fetch.error ?? "motivo desconocido"}.`,
    });
    fugas.push({
      titulo: "El sitio no se pudo cargar",
      que_se_pierde:
        "Si a nosotros no nos respondió, hay chances de que a un comprador tampoco. Cada visita que no carga es una consulta que no llega.",
    });
    return {
      madurez: 1,
      estado: "fallas_criticas",
      insight:
        "No pudimos acceder a tu sitio. Antes que cualquier otra cosa hay que confirmar que esté online y respondiendo.",
      checks: recortarChecks(checks),
    };
  }

  const seo = facts.seo;
  let madurez = 5;

  if (!seo.title) {
    madurez -= 1;
    checks.push({
      tipo: "error",
      titulo: "Sin título de página",
      detalle:
        "La home no tiene <title>: es lo primero que ve Google y lo que se lee en la pestaña del navegador.",
    });
  } else if (esTitleGenerico(seo.title)) {
    madurez -= 1;
    checks.push({
      tipo: "error",
      titulo: "Título genérico",
      detalle: `El título es "${seo.title}": no dice qué vendés ni a quién. No compite en resultados de búsqueda.`,
    });
  } else {
    checks.push({
      tipo: "ok",
      titulo: "Título presente",
      detalle: `Título: "${seo.title}" (${seo.titleLength} caracteres).`,
    });
  }

  if (!seo.metaDescription) {
    madurez -= 1;
    checks.push({
      tipo: "error",
      titulo: "Sin meta description",
      detalle:
        "Google arma solo el resumen que se ve en los resultados. Perdés el control de tu propio pitch.",
    });
  }

  if (seo.h1Count === 0) {
    madurez -= 1;
    checks.push({
      tipo: "error",
      titulo: "Sin H1",
      detalle:
        "La home no tiene título principal: ni el comprador ni Google saben de qué trata la página.",
    });
  } else if (seo.h1Count > 1) {
    checks.push({
      tipo: "alerta",
      titulo: `${seo.h1Count} H1 en la home`,
      detalle: "Más de un título principal diluye el mensaje. Debería haber uno solo.",
    });
  }

  if (seo.urlsCripticas > 0) {
    const proporcion = seo.urlsCripticas / Math.max(1, seo.urlsInternasTotal);
    if (proporcion > 0.3) madurez -= 1;
    checks.push({
      tipo: proporcion > 0.3 ? "error" : "alerta",
      titulo: `${seo.urlsCripticas} de ${seo.urlsInternasTotal} URLs crípticas`,
      detalle:
        "Hay direcciones internas que no dicen nada (ids, números, archivos .php). Ni el comprador ni Google entienden qué hay del otro lado.",
    });
  }

  for (const lib of (facts.tech?.libraries ?? []).filter((l) => l.desactualizada)) {
    madurez -= 1;
    checks.push({
      tipo: "alerta",
      titulo: `${lib.nombre} desactualizada`,
      detalle: `El sitio carga ${lib.nombre}${lib.version ? ` ${lib.version}` : ""}, una versión vieja: arrastra riesgos de seguridad y peso innecesario.`,
    });
  }

  const ps = facts.pageSpeed;
  if (ps.disponible && ps.performance !== null) {
    if (ps.performance < 50) {
      madurez -= 1;
      checks.push({
        tipo: "error",
        titulo: `Performance ${ps.performance}/100 en mobile`,
        detalle: `El sitio carga lento en celular${ps.lcpMs ? ` (LCP ${(ps.lcpMs / 1000).toFixed(1)} s)` : ""}. La mayoría se va antes de ver nada.`,
      });
    } else if (ps.performance < 90) {
      checks.push({
        tipo: "alerta",
        titulo: `Performance ${ps.performance}/100 en mobile`,
        detalle:
          "Hay margen de mejora en velocidad: cada segundo de más se paga en consultas perdidas.",
      });
    } else {
      checks.push({
        tipo: "ok",
        titulo: `Performance ${ps.performance}/100 en mobile`,
        detalle: "El sitio carga rápido en celular.",
      });
    }
  }

  madurez = acotar(madurez);

  if (madurez <= 2) {
    fugas.push({
      titulo: "El sitio no convierte la visita en consulta",
      que_se_pierde:
        "Con el mensaje y la estructura como están, el que entra no termina de entender qué ofrecés ni cómo contactarte.",
    });
  }

  return {
    madurez,
    estado: madurez >= 4 ? "activo" : madurez >= 2 ? "parcial" : "fallas_criticas",
    insight:
      madurez >= 4
        ? "Tu sitio está sano en lo básico. El trabajo fino ahora es de mensaje y conversión."
        : "Tu sitio tiene fallas que se arreglan rápido y cambian mucho: título, mensaje y estructura son lo primero que ve el que llega.",
    checks: recortarChecks(checks),
  };
}

/* ----------------------------------------------------------------------- seo */

function evaluarSeo(facts: SiteFacts, fugas: Fuga[]): Canal {
  const checks: Check[] = [];
  const seo = facts.seo;

  if (!seo) {
    checks.push({
      tipo: "alerta",
      titulo: "SEO on-page sin verificar",
      detalle:
        "Sin HTML no se pueden evaluar title, meta, idioma ni URLs. Queda a validar.",
    });
    return {
      madurez: 1,
      estado: "a_validar",
      insight: "No pudimos leer tu sitio, así que el SEO on-page queda a validar.",
      checks: recortarChecks(checks),
    };
  }

  let madurez = 5;

  if (!seo.title || esTitleGenerico(seo.title)) {
    madurez -= 1;
    checks.push({
      tipo: "error",
      titulo: "El título no apunta a una búsqueda",
      detalle:
        "El comprador no busca tu marca, busca la categoría. El título tiene que nombrar lo que vendés y dónde.",
    });
  } else if (seo.titleLength !== null && (seo.titleLength < 30 || seo.titleLength > 65)) {
    checks.push({
      tipo: "alerta",
      titulo: `Título de ${seo.titleLength} caracteres`,
      detalle:
        "Fuera del rango que Google muestra completo (30-65). Se corta o desaprovecha espacio.",
    });
  }

  if (!seo.metaDescription) {
    madurez -= 1;
    checks.push({
      tipo: "error",
      titulo: "Sin meta description",
      detalle: "No hay descripción propia para los resultados de búsqueda.",
    });
  } else if (
    seo.metaDescriptionLength !== null &&
    (seo.metaDescriptionLength < 70 || seo.metaDescriptionLength > 165)
  ) {
    checks.push({
      tipo: "alerta",
      titulo: `Meta description de ${seo.metaDescriptionLength} caracteres`,
      detalle: "Conviene entre 70 y 165 para que se lea completa en el resultado.",
    });
  }

  if (!seo.htmlLang) {
    madurez -= 1;
    checks.push({
      tipo: "alerta",
      titulo: "Sin atributo lang",
      detalle:
        "El HTML no declara idioma: Google tiene que adivinar a qué público mostrarlo.",
    });
  } else {
    checks.push({
      tipo: "ok",
      titulo: `Idioma declarado (${seo.htmlLang})`,
      detalle: "El HTML declara su idioma correctamente.",
    });
  }

  if (!seo.canonical) {
    checks.push({
      tipo: "alerta",
      titulo: "Sin canonical",
      detalle:
        "Sin URL canónica, la misma página puede indexarse duplicada y competir contra sí misma.",
    });
  }

  if (seo.urlsCripticas > 0) {
    madurez -= 1;
    checks.push({
      tipo: "error",
      titulo: "URLs que no describen el contenido",
      detalle: `${seo.urlsCripticas} de ${seo.urlsInternasTotal} direcciones internas no dicen qué hay del otro lado. Es una señal de ranking desperdiciada.`,
    });
  }

  madurez = acotar(madurez);

  if (madurez <= 3) {
    fugas.push({
      titulo: "No aparecés cuando te buscan por lo que vendés",
      que_se_pierde:
        "Si el título y las URLs no nombran la categoría, la búsqueda con intención de compra se la lleva otro.",
    });
  }

  return {
    madurez,
    estado: madurez >= 4 ? "activo" : madurez >= 2 ? "parcial" : "ausente",
    insight:
      madurez >= 4
        ? "Las señales básicas de SEO están en orden. Lo que sigue es contenido por intención de búsqueda."
        : "Hoy tu sitio le habla a quien ya te conoce. Al que busca la categoría sin conocerte, no lo alcanza.",
    checks: recortarChecks(checks),
  };
}

/* ------------------------------------------------------------------- comunes */

function armarResumen(
  company: CompanyForAnalysis,
  facts: SiteFacts,
  canales: Canales,
): string {
  const nombre = company.name?.trim() || "tu empresa";
  const promedio = promedioMadurez(canales);

  const partes: string[] = [];

  if (!facts.fetch.ok) {
    partes.push(
      `No pudimos acceder al sitio de ${nombre}, así que la arquitectura digital queda casi entera a validar.`,
    );
  } else if (promedio >= 4) {
    partes.push(
      `${nombre} tiene la arquitectura digital en orden: el sitio responde, se entiende y estás midiendo.`,
    );
  } else if (promedio >= 2.5) {
    partes.push(
      `${nombre} tiene una base digital que funciona, pero con huecos que hoy te están costando consultas.`,
    );
  } else {
    partes.push(
      `La arquitectura digital de ${nombre} está en un punto inicial: hay arreglos de bajo esfuerzo con mucho impacto.`,
    );
  }

  if (canales.medicion.madurez <= 2) {
    partes.push(
      "Lo más urgente es la medición: sin ella, cualquier peso que pongas en pauta se evalúa a ciegas.",
    );
  } else if (canales.sitio.madurez <= 3) {
    partes.push(
      "El primer foco está en el sitio: mensaje, título y estructura son lo que decide si la visita se convierte en consulta.",
    );
  } else {
    partes.push(
      "El paso siguiente es trabajar la intención de búsqueda para que te encuentren quienes todavía no te conocen.",
    );
  }

  return partes.join(" ");
}

/** El esquema exige 1 a 3 fugas. Si nada disparó una, damos la única que
 *  siempre es cierta y verificable: el diagnóstico todavía es parcial. */
function recortarFugas(fugas: Fuga[]): AnalysisOutput["fugas"] {
  if (fugas.length === 0) {
    return [
      {
        titulo: "El diagnóstico mira solo la home",
        que_se_pierde:
          "Lo verificado es la portada del sitio. Las páginas internas, que es donde suele caer la búsqueda que más vale, requieren una revisión manual.",
      },
    ];
  }
  return fugas.slice(0, 3);
}

function recortarChecks(checks: Check[]): Check[] {
  return checks.slice(0, 6);
}

function esTitleGenerico(title: string): boolean {
  const limpio = title.trim();
  return limpio.length < 15 || TITLES_GENERICOS.test(limpio);
}

function acotar(madurez: number): number {
  return Math.max(1, Math.min(5, madurez));
}

/* ------------------------------------------------------------------ contacto */

type Canales = AnalysisOutput["canales"];

/** Vías de contacto en la home. Es el canal que más pesa en el score: una
 *  consulta que llega y no encuentra dónde dejar el dato se pierde entera. */
function evaluarContacto(facts: SiteFacts, fugas: Fuga[]): Canal {
  const c = facts.contacto;
  const checks: Check[] = [];

  if (!c) {
    return {
      madurez: 1,
      estado: "a_validar",
      insight:
        "No pudimos leer la home, así que no sabemos por dónde puede contactarte alguien que llega. Queda a validar.",
      checks: [
        {
          tipo: "alerta",
          titulo: "Vías de contacto sin verificar",
          detalle: "Sin HTML no se puede contar cuántas formas hay de dejar un dato.",
        },
      ],
    };
  }

  // Ninguna vía en el HTML inicial NO es "no tiene vías": pueden cargar por JS
  // o la home puede ser un contenedor vacío. No se afirma ausencia ni se arma
  // una fuga sobre algo que no pudimos ver.
  if (c.viasTotal === 0) {
    const ciego = c.estado === "no_verificable";
    return {
      madurez: 2,
      estado: "a_validar",
      insight: ciego
        ? "Tu home se arma con JavaScript y no pudimos ver por dónde te contactan. Lo confirmamos con vos antes de sacar conclusiones."
        : "No detectamos automáticamente por dónde te contactan desde la home; puede cargar por JavaScript. Lo confirmamos con vos.",
      checks: [
        {
          tipo: "alerta",
          titulo: "Vías de contacto sin detectar",
          detalle: ciego
            ? "El contenido de la home se arma en el navegador, así que no se pudieron verificar el teléfono, el mail, WhatsApp ni el formulario. A confirmar."
            : "No detectamos teléfono, mail, WhatsApp ni formulario en el HTML inicial de la home. Pueden cargar por JavaScript. A confirmar.",
        },
      ],
    };
  }

  const vias: Array<[boolean, string, string]> = [
    [c.telefonoTocable, "Teléfono para tocar", "un enlace tel: que llame solo desde el celular"],
    [c.mailPublicado, "Mail publicado", "una dirección de mail visible"],
    [c.whatsapp, "WhatsApp", "un enlace directo a WhatsApp"],
    [c.formulario, "Formulario", "un formulario para dejar la consulta"],
  ];

  for (const [presente, titulo, que] of vias) {
    checks.push(
      presente
        ? { tipo: "ok", titulo: `${titulo}: sí`, detalle: `La home tiene ${que}.` }
        : {
            tipo: "alerta",
            titulo: `${titulo}: no detectado`,
            detalle: `No detectamos ${que} en el HTML inicial de la home; puede cargar por JavaScript. A confirmar.`,
          },
    );
  }

  // Un formulario que no pregunta nada no separa al cliente grande de una
  // consulta suelta: llega todo mezclado y sin contexto para responder.
  if (c.formulario && c.camposFormulario.length > 0 && c.camposFormulario.length <= 4) {
    checks.push({
      tipo: "alerta",
      titulo: "El formulario no califica",
      detalle: `Pide ${c.camposFormulario.length} datos (${c.camposFormulario
        .map((campo) => campo.nombre)
        .join(", ")}). No distingue qué tipo de cliente es ni qué necesita.`,
    });
  }

  if (!c.contactoEnMenu) {
    checks.push({
      tipo: "alerta",
      titulo: "Contacto no detectado en el menú",
      detalle:
        "No detectamos un enlace a contacto en la navegación de la home (el menú puede cargar por JavaScript). A confirmar.",
    });
  }

  // Las fugas se apoyan en lo DETECTADO (una sola vía a la vista), nunca en
  // una vía que no vimos: esa puede existir y cargar por JS.
  if (c.viasTotal === 1) {
    fugas.push({
      titulo: "Una sola vía de contacto a la vista",
      que_se_pierde:
        "En la home detectamos una única forma de contactarte. Si las demás no existen, el que prefiere otra no deja el dato; si cargan por JavaScript, conviene confirmarlo.",
    });
  }

  const madurez = acotar(c.viasTotal >= 3 ? (c.contactoEnMenu ? 5 : 4) : c.viasTotal + 1);

  return {
    madurez,
    estado: madurez >= 4 ? "activo" : "parcial",
    insight: `Detectamos ${c.viasTotal} de 4 vías de contacto en la home. ${
      c.viasTotal >= 3
        ? "Está bien cubierto: el que quiere escribirte, puede."
        : "Si las otras no existen, sumarlas es de las mejoras más baratas del diagnóstico."
    }`,
    checks: recortarChecks(checks),
  };
}

/* --------------------------------------------------------------------- orden */

/** Cómo está ordenado el sitio: la pregunta de la auditoría es si las
 *  secciones están puestas como piensa la empresa o como busca el comprador.
 *  Con solo la home, lo verificable son los links internos y sus URLs. */
function evaluarOrden(facts: SiteFacts, fugas: Fuga[]): Canal {
  const seo = facts.seo;
  const checks: Check[] = [];

  if (!seo) {
    return {
      madurez: 1,
      estado: "a_validar",
      insight: "Sin HTML no se puede ver cómo está ordenado el sitio. Queda a validar.",
      checks: [
        {
          tipo: "alerta",
          titulo: "Estructura sin verificar",
          detalle: "No se pudieron leer los enlaces internos de la home.",
        },
      ],
    };
  }

  const total = seo.urlsInternasTotal;
  const cripticas = seo.urlsCripticas;

  if (total === 0) {
    checks.push({
      tipo: "error",
      titulo: "La home no enlaza a ninguna página interna",
      detalle:
        "No se encontraron links internos en el HTML inicial. Ni el comprador ni Google tienen por dónde seguir.",
    });
    fugas.push({
      titulo: "El sitio no tiene por dónde seguir",
      que_se_pierde:
        "Desde la home no se llega a ninguna página interna. El que quiere saber más se queda sin camino.",
    });
  } else {
    checks.push({
      tipo: "ok",
      titulo: `${total} páginas enlazadas desde la home`,
      detalle: "Hay estructura interna para recorrer.",
    });
  }

  if (cripticas > 0) {
    const ejemplos = seo.urlsInternas
      .filter((u) => !u.descriptiva)
      .slice(0, 3)
      .map((u) => `/${u.slug} (${u.motivo})`)
      .join(", ");
    checks.push({
      tipo: cripticas >= total / 2 ? "error" : "alerta",
      titulo: `${cripticas} de ${total} URLs no dicen qué hay adentro`,
      detalle: `Por ejemplo: ${ejemplos}. Una URL que no se entiende no ayuda a rankear ni da confianza al que la ve.`,
    });
  } else if (total > 0) {
    checks.push({
      tipo: "ok",
      titulo: "Las URLs son descriptivas",
      detalle: "Cada dirección dice qué hay en esa página.",
    });
  }

  const madurez = acotar(
    total === 0 ? 1 : cripticas === 0 ? (total >= 5 ? 5 : 4) : cripticas >= total / 2 ? 2 : 3,
  );

  return {
    madurez,
    estado: total === 0 ? "ausente" : madurez >= 4 ? "activo" : "parcial",
    insight:
      total === 0
        ? "La home no lleva a ninguna parte. Ordenar el sitio por lo que busca el comprador es el primer paso."
        : `El sitio se recorre a través de ${total} páginas. Lo que queda para la revisión manual es si están ordenadas como busca el comprador o como está organizada la empresa puertas adentro.`,
    checks: recortarChecks(checks),
  };
}

/* -------------------------------------------------------- portada y cierre */

function armarTesis(
  company: CompanyForAnalysis,
  facts: SiteFacts,
  canales: Canales,
): AnalysisOutput["tesis"] {
  const nombre = company.name?.trim() || "Tu empresa";

  if (!facts.fetch.ok) {
    return {
      titular: "No pudimos entrar a tu sitio.",
      bajada:
        "Si a nosotros no nos respondió, hay chances de que a un comprador tampoco. Es lo primero a resolver.",
    };
  }

  const vias = facts.contacto?.viasTotal ?? 0;
  if (vias <= 1) {
    return {
      titular: "Tu sitio está online.",
      bajada:
        vias === 0
          ? "Falta confirmar por dónde te llega la consulta."
          : "Detectamos una sola forma de dejar un dato.",
    };
  }

  if (canales.medicion.madurez <= 2) {
    return {
      titular: "El sitio recibe consultas.",
      bajada: "Nadie puede decir de dónde vinieron.",
    };
  }

  return {
    titular: acortar(`${nombre} tiene la base armada.`, 60),
    bajada: "Lo que falta son los detalles que convierten una visita en consulta.",
  };
}

/** "Lo que ya tienen": arranca por lo que juega a favor. Puede quedar vacío
 *  —un sitio caído no tiene activos— y en ese caso la sección no se dibuja. */
function armarActivos(facts: SiteFacts): Numero[] {
  const activos: Numero[] = [];
  const seo = facts.seo;
  const c = facts.contacto;
  const t = facts.tracking;

  if (seo && seo.urlsInternasTotal > 0) {
    activos.push({
      dato: String(seo.urlsInternasTotal),
      etiqueta: "Páginas enlazadas desde la home, listas para ordenar por cliente",
    });
  }
  if (seo?.title && !esTitleGenerico(seo.title)) {
    activos.push({
      dato: "Título propio",
      etiqueta: `La home se presenta como "${acortar(seo.title, 60)}"`,
    });
  }
  if (c && c.viasTotal > 0) {
    activos.push({
      dato: `${c.viasTotal} de 4`,
      etiqueta: "Vías de contacto ya presentes en la home",
    });
  }
  if (t?.ga4) {
    activos.push({
      dato: "GA4",
      etiqueta: "Analítica instalada: la base para medir ya está puesta",
    });
  }
  if (facts.tech?.cms) {
    activos.push({
      dato: acortar(facts.tech.cms, 14),
      etiqueta: "Plataforma del sitio: se puede editar sin rehacer nada",
    });
  }
  if (facts.dmarc?.exists) {
    activos.push({ dato: "DMARC", etiqueta: "El dominio está protegido contra suplantación" });
  }

  return activos.slice(0, 6);
}

/** El recorrido del comprador DENTRO del sitio. No inventamos de dónde vino:
 *  no tenemos datos de búsquedas ni de tráfico. */
function armarRecorrido(facts: SiteFacts): AnalysisOutput["recorrido"] {
  const c = facts.contacto;
  const seo = facts.seo;

  if (!facts.fetch.ok) {
    return [
      { paso: "LLEGA", detalle: "Alguien entra al sitio con intención de comprar." },
      {
        paso: "NO CARGA",
        detalle: `El sitio no respondió: ${facts.fetch.error ?? "no se pudo cargar"}.`,
      },
      { paso: "SE VA", detalle: "Vuelve a Google y entra al de al lado." },
    ];
  }

  return [
    { paso: "LLEGA", detalle: "Alguien entra a la home con intención de comprar." },
    {
      paso: "LEE",
      detalle: seo?.title
        ? `Lo primero que ve es "${acortar(seo.title, 70)}".`
        : "La página no tiene título: no hay una primera frase que le diga dónde está.",
    },
    {
      paso: "BUSCA CÓMO",
      detalle:
        c && c.viasTotal > 0
          ? `Encuentra ${c.viasTotal} forma${c.viasTotal > 1 ? "s" : ""} de contactarse.`
          : "Busca un teléfono, un mail o un formulario. No los detectamos automáticamente en la home.",
    },
    {
      paso: c && c.viasTotal > 0 ? "ESCRIBE" : "A CONFIRMAR",
      detalle:
        c && c.viasTotal > 0
          ? "Deja la consulta. Sin medición, nadie va a saber que llegó por acá."
          : "Si las vías cargan por JavaScript, escribe. Lo confirmamos con vos.",
    },
  ];
}

/** El Método Qualita: siempre los 6 pasos, en su orden (analysis-2.0.0). El
 *  detalle se ata a lo que ESTE diagnóstico encontró. */
function armarPlan(canales: Canales): AnalysisOutput["plan"] {
  return [
    {
      titulo: "Diagnóstico y arquitectura",
      detalle:
        canales.orden.madurez <= 3
          ? "Una página por lo que el comprador viene a resolver, con URLs que digan qué hay adentro."
          : "La estructura actual se mantiene; se suman páginas por lo que busca el comprador.",
    },
    {
      titulo: "Sitio que convierte",
      detalle:
        canales.contacto.madurez <= 3
          ? "Teléfono, mail, WhatsApp y formulario visibles en cada página, no en una sola."
          : "Cada página con una vía de consulta a mano y un mensaje que diga qué se vende.",
    },
    {
      titulo: "Medición unificada",
      detalle: "GA4, Tag Manager, píxel y conversiones sobre cada consulta y cada clic a WhatsApp.",
    },
    {
      titulo: "Captación que califica",
      detalle: "Un formulario que pregunte rubro, tipo de cliente y volumen antes del mensaje libre.",
    },
    {
      titulo: "Comunicación y marca",
      detalle:
        canales.busqueda.madurez <= 3
          ? "Título, descripción y encabezados que nombren la categoría, no solo la marca."
          : "Lo que cuenta quién es la empresa pasa a la home, con pruebas a la vista.",
    },
    {
      titulo: "Publicidad que alimenta",
      detalle: "Recién acá se refuerza la pauta, sobre una estructura que recibe y mide.",
    },
  ];
}

/* ------------------------------------------------- láminas (analysis-2.0.0) */

/** La escena de la lámina "La pregunta que ordena". El mock no sabe quién es
 *  el comprador del rubro, así que la escena es genérica y lo dice. */
function armarEscena(company: CompanyForAnalysis, facts: SiteFacts): AnalysisOutput["escena"] {
  const rubro = company.industry?.trim();
  return {
    pregunta: acortar(
      `Alguien necesita ${rubro ? `resolver algo de ${rubro.toLowerCase()}` : "lo que vende la empresa"} y entra al sitio. ¿Qué pasa cuando llega?`,
      130,
    ),
    necesidad: "Quiere entender si le sirve, pedir una cotización y que alguien le conteste.",
    cita: null,
    conclusion: facts.fetch.ok
      ? acortar(
          `La consulta ${facts.contacto && facts.contacto.viasTotal > 0 ? "puede llegar" : "no sabemos por dónde llega"}, pero nada registra de dónde vino ni qué necesitaba.`,
          250,
        )
      : "El sitio no respondió al verificarlo: la consulta no tiene dónde caer hasta que eso se resuelva.",
  };
}

function armarConclusiones(company: CompanyForAnalysis): AnalysisOutput["conclusiones"] {
  const nombre = acortar(company.name?.trim() || "La empresa", 40);
  return {
    alcance: `Este diagnóstico mira qué pasa en el sitio de ${nombre} y con el dato, que es donde se define si la demanda que llega rinde.`,
    punto_de_partida: `Esto es lo que ${nombre} ya tiene a favor en el sitio. Lo que sigue muestra qué le pasa a la consulta cuando llega.`,
    metodo: "La publicidad es la última etapa, no la primera: pautar sobre un sitio que no capta ni mide es gastar a ciegas.",
    nota_metodo:
      "Cada dato del informe sale del código del sitio o del registro del dominio. Lo que no se pudo verificar quedó marcado.",
    a_validar:
      "A validar con el cliente (accesos de solo lectura): cuentas de Google Ads y Meta, Search Console y cómo se registran hoy las consultas. No se estimaron cifras de inversión, impresiones ni resultados: no son públicas.",
  };
}

/** Sin búsqueda no hay canales externos: van en null y no puntúan. */
function armarScoreCanales(canales: Canales): AnalysisOutput["score_canales"] {
  const sinBusqueda = { madurez: null, detalle: "No relevado en esta versión de prueba." };
  return {
    google_organico: sinBusqueda,
    redes_ficha: sinBusqueda,
    sitio: { detalle: acortar(canales.sitio.insight, 115) },
    google_ads: sinBusqueda,
    meta_ads: sinBusqueda,
    medicion: { detalle: acortar(canales.medicion.insight, 115) },
    conclusion:
      "Esta versión de prueba solo puntúa lo que sale del código del sitio. Los canales externos quedan para la corrida real.",
  };
}

function armarSintesis(
  company: CompanyForAnalysis,
  activos: Numero[],
  fugas: Fuga[],
  plan: AnalysisOutput["plan"],
): AnalysisOutput["sintesis"] {
  const nombre = acortar(company.name?.trim() || "La empresa", 40);
  const tiene = activos.slice(0, 4).map((activo) => acortar(`${activo.dato}: ${activo.etiqueta}`, 90));
  return {
    titulo: acortar(`${nombre} tiene la base. Falta que el sitio reciba y mida la consulta.`, 125),
    tiene: tiene.length > 0 ? tiene : ["Un sitio online para empezar a ordenar."],
    falta: fugas.slice(0, 4).map((fuga) => acortar(fuga.titulo, 90)),
    oportunidad: plan.slice(0, 4).map((paso) => acortar(paso.detalle, 145)),
    conclusion: "El orden importa: primero que el sitio reciba y mida, después pautar.",
  };
}

/** La lámina de captación, solo con el formulario de la home. Sin formulario
 *  detectado no hay nada que comparar y la lámina no va. */
function armarCaptacion(
  company: CompanyForAnalysis,
  facts: SiteFacts,
): AnalysisOutput["captacion"] {
  const campos = facts.contacto?.camposFormulario ?? [];
  if (campos.length === 0) return null;

  const celdas = campos.slice(0, 6).map((campo) => ({
    texto: acortar(campo.nombre, 42),
    destacado: false,
  }));
  return {
    titulo: "El formulario pide los datos de contacto. No pregunta qué necesita quien consulta.",
    propio: {
      etiqueta: acortar(`${company.name?.trim() || "Empresa"} · home`, 60),
      campos: [...celdas, { texto: "¿Qué tipo de cliente sos?", destacado: true }],
      nota: "El campo en color no existe: la consulta llega sin con qué separarla.",
    },
    competidor: null,
    conclusion: "Sin una pregunta que califique, la consulta grande entra por la misma puerta que la chica.",
  };
}
function armarCierre(
  company: CompanyForAnalysis,
  facts: SiteFacts,
  canales: Canales,
): AnalysisOutput["cierre"] {
  const numeros: Numero[] = [];
  const c = facts.contacto;
  const seo = facts.seo;
  const t = facts.tracking;

  // Sin sitio legible no hay números que sacar del HTML. En vez de inventar
  // relleno para llegar al mínimo, decimos exactamente eso.
  if (!facts.fetch.ok) {
    numeros.push(
      { dato: "0", etiqueta: "Páginas del sitio que pudimos leer" },
      { dato: "0 de 4", etiqueta: "Vías de contacto que pudimos verificar" },
      {
        dato: facts.inputUrl ? "No responde" : "Sin sitio",
        etiqueta: facts.inputUrl
          ? `${facts.inputUrl} no contestó al momento de la verificación`
          : "La empresa no informó un sitio web para analizar",
      },
    );
  }

  // Solo lo detectado va como número: un "0" grande en pantalla afirma una
  // ausencia que desde el HTML estático no podemos verificar.
  if (c && c.viasTotal > 0) {
    numeros.push({
      dato: `${c.viasTotal} de 4`,
      etiqueta: "Vías de contacto detectadas en la home",
    });
  }
  if (seo) {
    numeros.push({
      dato: String(seo.urlsInternasTotal),
      etiqueta: "Páginas enlazadas desde la home",
    });
    if (!seo.metaDescription) {
      numeros.push({
        dato: "0",
        etiqueta: "Descripciones para lo que Google muestra debajo del título",
      });
    }
  }
  if (t && !t.metaPixel) {
    numeros.push({
      dato: "Sin píxel",
      etiqueta: "No se puede volver a alcanzar a quien ya visitó el sitio",
    });
  }
  numeros.push({
    // La misma cuenta que el score guardado: un número propio acá diría otra
    // cosa que la portada.
    dato: String(computeScores({ canales }).score_general),
    etiqueta: "Puntaje de arquitectura digital sobre 100",
  });

  const nombre = company.name?.trim() || "Tu empresa";

  return {
    titular:
      (c?.viasTotal ?? 0) === 0
        ? `${nombre} ya tiene el sitio online. Lo primero es confirmar por dónde le llega la consulta.`
        : `${nombre} ya tiene con qué. Lo que falta es que el sitio esté a la altura de la empresa.`,
    numeros: numeros.slice(0, 6),
  };
}

function promedioMadurez(canales: Canales): number {
  const todos = [
    canales.sitio,
    canales.contacto,
    canales.orden,
    canales.busqueda,
    canales.medicion,
  ];
  return todos.reduce((suma, canal) => suma + canal.madurez, 0) / todos.length;
}

function acortar(texto: string, largo: number): string {
  const limpio = texto.trim();
  return limpio.length <= largo ? limpio : `${limpio.slice(0, largo - 1)}…`;
}
