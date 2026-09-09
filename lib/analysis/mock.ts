import "server-only";

import type { SiteFacts } from "./collect";
import type { CompanyForAnalysis } from "./prompt";
import type { AnalysisOutput } from "./schema";

/** Generador MOCK del análisis. Reemplaza SOLO la llamada a Claude: la salida
 *  se valida contra el mismo `analysisOutput` y pasa por el mismo scoring que
 *  en modo live. Sirve para ejercitar el pipeline entero (collect → parse →
 *  score → guardado → polling) sin gastar la ANTHROPIC_API_KEY.
 *
 *  Regla de oro: todo lo que dice el mock se DERIVA de los facts reales. Si un
 *  hallazgo no está en los facts, no aparece acá tampoco. */

export const MOCK_ANALYSIS_VERSION = "analysis-mock-1.0.0";

type Check = AnalysisOutput["infra"]["sitio"]["checks"][number];
type Canal = AnalysisOutput["infra"]["sitio"];
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
  const seo = evaluarSeo(facts, fugas);

  return {
    resumen: armarResumen(company, facts, { sitio, seo, medicion }),
    infra: {
      sitio,
      seo,
      medicion,
      google_ads: {
        estado: "a_validar",
        insight:
          "Google Ads no se mide en esta versión del diagnóstico: hace falta acceso de solo lectura a la cuenta para confirmar si hay campañas activas, con qué estructura y con qué conversión. Queda a validar.",
      },
      meta_ads: {
        estado: "a_validar",
        insight:
          "Meta Ads no se mide en esta versión: sin acceso al Administrador Comercial no se puede afirmar si hay pauta activa ni cómo está midiendo. Queda a validar.",
      },
    },
    fugas: recortarFugas(fugas),
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
  canales: { sitio: Canal; seo: Canal; medicion: Canal },
): string {
  const nombre = company.name?.trim() || "tu empresa";
  const promedio =
    (canales.sitio.madurez + canales.seo.madurez + canales.medicion.madurez) / 3;

  const partes: string[] = [];

  if (!facts.fetch.ok) {
    partes.push(
      `No pudimos acceder al sitio de ${nombre}, así que la infraestructura digital queda casi entera a validar.`,
    );
  } else if (promedio >= 4) {
    partes.push(
      `${nombre} tiene la infraestructura digital en orden: el sitio responde, se entiende y estás midiendo.`,
    );
  } else if (promedio >= 2.5) {
    partes.push(
      `${nombre} tiene una base digital que funciona, pero con huecos que hoy te están costando consultas.`,
    );
  } else {
    partes.push(
      `La infraestructura digital de ${nombre} está en un punto inicial: hay arreglos de bajo esfuerzo con mucho impacto.`,
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
        titulo: "El diagnóstico todavía no ve la pauta",
        que_se_pierde:
          "Google Ads y Meta Ads quedaron a validar. Si hay inversión activa, no sabemos qué está devolviendo.",
      },
    ];
  }
  return fugas.slice(0, 3);
}

function recortarChecks(checks: Check[]): Check[] {
  return checks.slice(0, 8);
}

function esTitleGenerico(title: string): boolean {
  const limpio = title.trim();
  return limpio.length < 15 || TITLES_GENERICOS.test(limpio);
}

function acotar(madurez: number): number {
  return Math.max(1, Math.min(5, madurez));
}
