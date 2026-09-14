/** Canal de contacto con Qualita para los CTA de la vista cliente.
 *
 *  Va por api.whatsapp.com y no por web.whatsapp.com: la versión web solo sirve
 *  en desktop, y en el celular (donde se abre la mayoría de los informes, desde
 *  el mail) manda a una página de descarga. api.whatsapp.com abre la app en el
 *  teléfono y WhatsApp Web en la compu, con el mismo número y mensaje. */
export const WHATSAPP_QUALITA =
  "https://api.whatsapp.com/send?phone=5491133474768&text=Hola!%20Tengo%20una%20consulta%20y%20me%20gustar%C3%ADa%20charlar%20con%20alguien%20del%20equipo.";
