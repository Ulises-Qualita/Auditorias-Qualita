import "server-only";
import * as cheerio from "cheerio";

/** Vías de contacto visibles en la home.
 *
 *  Es el hallazgo más pesado de la auditoría de referencia ("en todo el sitio
 *  hay una sola forma de dejar un dato"): de nada sirve rankear si la consulta
 *  llega a una página donde no hay dónde dejar el dato.
 *
 *  DOS LÍMITES que hay que respetar al redactar hallazgos:
 *  1. Miramos SOLO la home, no página por página como la auditoría a mano. Lo
 *     que sale de acá se afirma de la home, nunca "de todo el sitio".
 *  2. Vemos el HTML inicial. Un formulario montado por JS (typeform, chat,
 *     widget de WhatsApp) no aparece. Por eso cada vía tiene TRES estados,
 *     como el DMARC: detectado / no detectado en el HTML inicial / no
 *     verificable. Solo la presencia se puede afirmar; la ausencia nunca. */

export type EstadoDeteccion =
  /** Está en el HTML inicial, con evidencia (el href, el form). */
  | "detectado"
  /** No está en el HTML inicial. NO significa que no exista: pudo cargar por JS. */
  | "no_detectado_html_inicial"
  /** No se pudo mirar: el parseo falló o la home es un contenedor de JS vacío. */
  | "no_verificable";

export type CampoFormulario = {
  /** name o id del campo, que es lo que delata qué se pregunta. */
  nombre: string;
  tipo: string;
};

export type ContactoFacts = {
  /** Estado de las vías en conjunto: "detectado" si hay al menos una. */
  estado: EstadoDeteccion;
  /** Estado de cada vía. Es lo que hay que leer antes que los booleanos. */
  estados: {
    telefono: EstadoDeteccion;
    mail: EstadoDeteccion;
    whatsapp: EstadoDeteccion;
    formulario: EstadoDeteccion;
  };
  /** Motivo técnico crudo cuando algo no se detectó o no se pudo verificar.
   *  Es para la consola interna; al informe llega el warning legible. */
  motivo: string | null;
  /** Rastros en el HTML de widgets que montan formularios o chats por JS
   *  (Typeform, HubSpot, tawk.to...). Indicio, no evidencia de una vía. */
  senalesJs: string[];
  /** Los booleanos: true = detectado con evidencia; false = NO detectado en el
   *  HTML inicial, que no es lo mismo que "no existe".
   *  <a href="tel:…">: el teléfono que se toca desde el celular. */
  telefonoTocable: boolean;
  telefonos: string[];
  /** <a href="mailto:…"> */
  mailPublicado: boolean;
  mails: string[];
  /** wa.me / api.whatsapp.com / web.whatsapp */
  whatsapp: boolean;
  /** Formulario de contacto: un <form> con campos de datos, o un grupo de
   *  campos sueltos sin <form> (Framer, Webflow, forms armados en JS que
   *  mandan a WhatsApp). Excluye buscadores y newsletters. */
  formulario: boolean;
  formulariosTotal: number;
  /** Cuántos de esos formularios son campos sueltos, sin etiqueta <form>. */
  formulariosSinForm: number;
  /** De dónde sale el WhatsApp: un link wa.me, o un botón que lo nombra
   *  (típico de los forms que abren WhatsApp por JS). */
  whatsappEvidencia: "link" | "boton" | null;
  /** Los campos del primer formulario de contacto: sirven para decir si el
   *  formulario CALIFICA al que consulta o solo junta un mensaje suelto. */
  camposFormulario: CampoFormulario[];
  /** Cuántas de las 4 vías (teléfono, mail, WhatsApp, formulario) se
   *  DETECTARON en el HTML inicial. 0 no es "cero vías": es "ninguna visible". */
  viasTotal: number;
  /** Link a una página de contacto en la navegación (el menú también puede ser JS). */
  contactoEnMenu: boolean;
};

function noVerificable(motivo: string): ContactoFacts {
  return {
    estado: "no_verificable",
    estados: {
      telefono: "no_verificable",
      mail: "no_verificable",
      whatsapp: "no_verificable",
      formulario: "no_verificable",
    },
    motivo,
    senalesJs: [],
    telefonoTocable: false,
    telefonos: [],
    mailPublicado: false,
    mails: [],
    whatsapp: false,
    formulario: false,
    formulariosTotal: 0,
    formulariosSinForm: 0,
    whatsappEvidencia: null,
    camposFormulario: [],
    viasTotal: 0,
    contactoEnMenu: false,
  };
}

/** Un buscador o un alta de newsletter no es una vía de contacto: contarlos
 *  infla el número y le miente al cliente sobre lo que tiene. */
const FORM_NO_CONTACTO = /search|buscar|busqueda|newsletter|suscri|subscribe|login|ingres|acceso|carrito|cart/i;

const CAMPO_IGNORADO = /^(submit|button|hidden|image|reset|checkbox|radio)$/i;

/** Campos trampa anti-spam: están en el HTML pero escondidos por CSS, y
 *  ninguna persona los completa. No cuentan como un dato que se pide. */
const CAMPO_TRAMPA = /honeypot|^website$|^url$|^hp[_-]|_gotcha|^fax$/i;

/** Un grupo de campos sueltos es un formulario de contacto solo si pide
 *  algo con qué responder: un mail, un teléfono o un mensaje. */
const TIPO_CONTACTO = /^(email|tel|textarea)$/i;

/** Widgets que montan formularios, chats o botones de WhatsApp desde JS. Si
 *  aparecen, es probable que haya una vía que el HTML inicial no muestra. */
const WIDGETS_JS: Array<[RegExp, string]> = [
  [/typeform\.com/i, "Typeform"],
  [/hsforms\.(net|com)|hbspt\.forms/i, "formulario de HubSpot"],
  [/jotform\.(com|us)/i, "Jotform"],
  [/docs\.google\.com\/forms|forms\.gle/i, "Google Forms"],
  [/embed\.tawk\.to/i, "chat tawk.to"],
  [/tidio\.co/i, "chat Tidio"],
  [/client\.crisp\.chat/i, "chat Crisp"],
  [/jivosite|jivochat/i, "chat JivoChat"],
  [/widget\.intercom\.io|intercomSettings/i, "chat Intercom"],
  [/static\.zdassets\.com|zopim/i, "chat Zendesk"],
  [/joinchat|wa-widget|click-to-chat|whatsapp-button|getbutton\.io|elfsight/i, "widget de WhatsApp"],
  [/wpforms|contact-form-7|wpcf7|gform_|ninja-forms|elementor-form|fluentform/i, "plugin de formularios"],
  [/wix-forms|static\.parastorage\.com/i, "sitio Wix (formularios por JS)"],
];

/** Menos texto visible que esto, con scripts o un contenedor de montaje, es
 *  una home que se arma en el navegador: lo que no vemos no es ausencia. */
const TEXTO_MINIMO_SHELL = 200;

/** En la vida real aparecen href sin comillas ('href=tel:+549... target=_blank'),
 *  y el parser devuelve el atributo siguiente pegado al número. Nos quedamos
 *  solo con lo que puede ser un teléfono, y exigimos 6 dígitos para no guardar
 *  basura como si fuera un contacto. */
function limpiarTelefono(crudo: string): string | null {
  // Cortamos en el primer carácter que un teléfono no puede tener (una letra,
  // un "="): así "+549... target=_blank" pierde la cola, pero un número
  // escrito con espacios, "+54 291 456 7890", se conserva entero.
  const limpio = (crudo.match(/^[+\d()\-.\s]*/)?.[0] ?? "").replace(/\s+/g, " ").trim();
  const digitos = limpio.replace(/\D/g, "").length;
  // Menos de 6 dígitos no es un teléfono: es basura de parseo o un interno.
  return digitos >= 6 ? limpio : null;
}

export function detectContacto(html: string): ContactoFacts {
  try {
    const $ = cheerio.load(html);

    /** Los campos de datos de un grupo, sin botones, trampas ni buscadores.
     *  Los forms sin <form> suelen no tener name: el placeholder es lo que
     *  dice qué se pregunta. */
    const camposDe = (elementos: ReturnType<typeof $>[number][]): CampoFormulario[] => {
      const campos: CampoFormulario[] = [];
      for (const campoEl of elementos) {
        const campo = $(campoEl);
        const tipo = (campo.attr("type") ?? ("tagName" in campoEl ? campoEl.tagName : "") ?? "text").toLowerCase() || "text";
        if (CAMPO_IGNORADO.test(tipo)) continue;
        const nombre = (campo.attr("name") ?? campo.attr("id") ?? campo.attr("placeholder") ?? "").trim();
        if (nombre && (FORM_NO_CONTACTO.test(nombre) || CAMPO_TRAMPA.test(nombre))) continue;
        // Un textarea no tiene type: el tagName es lo que lo identifica.
        campos.push({ nombre: nombre || "(sin nombre)", tipo });
      }
      return campos;
    };

    const telefonos = new Set<string>();
    const mails = new Set<string>();
    let whatsapp = false;

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") ?? "").trim();
      if (/^tel:/i.test(href)) {
        const numero = limpiarTelefono(href.slice(4));
        if (numero) telefonos.add(numero);
      } else if (/^mailto:/i.test(href)) {
        // Cortamos en "?" para no guardar el ?subject= como parte del mail.
        const mail = href.slice(7).split("?")[0].trim();
        if (mail) mails.add(mail);
      } else if (/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\/)/i.test(href)) {
        whatsapp = true;
      }
    });

    // Formularios: descartamos los que por su acción, clase o campos son
    // buscadores o newsletters.
    let formulariosTotal = 0;
    let camposFormulario: CampoFormulario[] = [];

    $("form").each((_, el) => {
      const form = $(el);
      const firma = [
        form.attr("action") ?? "",
        form.attr("id") ?? "",
        form.attr("class") ?? "",
        form.attr("role") ?? "",
      ].join(" ");
      if (FORM_NO_CONTACTO.test(firma)) return;

      const campos = camposDe(form.find("input, select, textarea").toArray());

      // Un solo campo de texto suelto es un buscador disfrazado, no un
      // formulario de contacto.
      if (campos.length < 2) return;

      formulariosTotal += 1;
      if (camposFormulario.length === 0) camposFormulario = campos.slice(0, 12);
    });

    // Formularios sin <form>: Framer, Webflow y los forms que arman el envío
    // por JS (por ejemplo, abriendo WhatsApp con los datos) ponen los campos
    // sueltos en divs. Están en el HTML inicial igual; se agrupan por la
    // sección que los contiene y se exige que pidan algo con qué responder.
    const sueltos = new Map<unknown, ReturnType<typeof $>[number][]>();
    $("input, select, textarea").each((_, el) => {
      const campo = $(el);
      if (campo.closest("form").length > 0) return;
      const contenedor = campo.closest("section, footer, aside, [id]").get(0) ?? "body";
      const grupo = sueltos.get(contenedor) ?? [];
      grupo.push(el);
      sueltos.set(contenedor, grupo);
    });

    let formulariosSinForm = 0;
    for (const [contenedor, elementos] of sueltos) {
      if (contenedor !== "body") {
        const $c = $(contenedor as Parameters<typeof $>[0]);
        const firma = `${$c.attr("id") ?? ""} ${$c.attr("class") ?? ""}`;
        if (FORM_NO_CONTACTO.test(firma)) continue;
      }
      const campos = camposDe(elementos);
      if (campos.length < 2 || !campos.some((c) => TIPO_CONTACTO.test(c.tipo))) continue;

      formulariosTotal += 1;
      formulariosSinForm += 1;
      if (camposFormulario.length === 0) camposFormulario = campos.slice(0, 12);
    }

    // WhatsApp sin link wa.me: el botón que envía el form a WhatsApp por JS.
    // El texto del botón es evidencia visible, pero se guarda aparte del link.
    let whatsappEvidencia: ContactoFacts["whatsappEvidencia"] = whatsapp ? "link" : null;
    if (!whatsapp) {
      const boton = $("button, a, [role=button]")
        .toArray()
        .some((el) => {
          const texto = $(el).text().replace(/\s+/g, " ").trim();
          return texto.length > 0 && texto.length <= 80 && /whats\s?app/i.test(texto);
        });
      if (boton) {
        whatsapp = true;
        whatsappEvidencia = "boton";
      }
    }

    const formulario = formulariosTotal > 0;
    const telefonoTocable = telefonos.size > 0;
    const mailPublicado = mails.size > 0;

    // "Contacto" alcanzable desde la navegación. La auditoría encontró una
    // página de contacto real a la que no se llegaba desde ningún lado.
    const contactoEnMenu = $("nav a, header a")
      .toArray()
      .some((el) => {
        const $el = $(el);
        const texto = ($el.text() ?? "").toLowerCase();
        const href = ($el.attr("href") ?? "").toLowerCase();
        return /contacto|contactanos|cont[aá]ctenos|contact/.test(`${texto} ${href}`);
      });

    const senalesJs = [
      ...new Set(WIDGETS_JS.filter(([patron]) => patron.test(html)).map(([, nombre]) => nombre)),
    ];

    // ¿La home es un contenedor casi vacío que se llena con JS? Cambia qué
    // significa no encontrar algo: ahí no es "no detectado", es "no pudimos mirar".
    const cuerpo = $("body").clone();
    cuerpo.find("script, style, noscript, template").remove();
    const textoVisible = cuerpo.text().replace(/\s+/g, " ").trim().length;
    const montaje =
      $("#root, #__next, #app, #__nuxt, [data-reactroot], [ng-app], [ng-version]").length > 0;
    const esShellJs = textoVisible < TEXTO_MINIMO_SHELL && (montaje || $("script[src]").length > 0);

    const noEncontrado: EstadoDeteccion = esShellJs ? "no_verificable" : "no_detectado_html_inicial";
    const estadoDe = (presente: boolean): EstadoDeteccion => (presente ? "detectado" : noEncontrado);

    const viasTotal = [telefonoTocable, mailPublicado, whatsapp, formulario].filter(Boolean).length;

    let motivo: string | null = null;
    if (esShellJs) {
      motivo = `HTML inicial con ${textoVisible} caracteres de texto visible${
        montaje ? " y un contenedor de montaje de JS" : ""
      }: la home se arma en el navegador y no se puede verificar desde el HTML estático.`;
    } else if (viasTotal < 4) {
      motivo =
        "Vías buscadas en el HTML inicial de la home, sin ejecutar JS: lo no detectado puede cargar por JavaScript.";
    }
    if (motivo && senalesJs.length > 0) {
      motivo += ` Rastros de widgets JS: ${senalesJs.join(", ")}.`;
    }

    return {
      estado: viasTotal > 0 ? "detectado" : noEncontrado,
      estados: {
        telefono: estadoDe(telefonoTocable),
        mail: estadoDe(mailPublicado),
        whatsapp: estadoDe(whatsapp),
        formulario: estadoDe(formulario),
      },
      motivo,
      senalesJs,
      telefonoTocable,
      telefonos: [...telefonos].slice(0, 6),
      mailPublicado,
      mails: [...mails].slice(0, 6),
      whatsapp,
      formulario,
      formulariosTotal,
      formulariosSinForm,
      whatsappEvidencia,
      camposFormulario,
      viasTotal,
      contactoEnMenu,
    };
  } catch (error) {
    // Antes esto devolvía todo en false: una ausencia inventada por un error
    // nuestro. Si no pudimos mirar, es no verificable.
    const detalle = error instanceof Error ? error.message : "error desconocido";
    return noVerificable(`No se pudo parsear el HTML de la home (${detalle}).`);
  }
}
