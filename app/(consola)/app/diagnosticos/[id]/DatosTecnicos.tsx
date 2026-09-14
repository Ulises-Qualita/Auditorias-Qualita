import type { FactsInterno } from "@/lib/consola/facts";
import { TEXTOS_MEJORAS } from "@/lib/diagnostico/mejorasPageSpeed";

/** Los hechos crudos que juntó el colector, tal como quedaron guardados.
 *
 *  Esto NO existe en el informe del cliente: es la diferencia entre la vista
 *  interna y la pública. Sirve para auditar el análisis —de dónde salió cada
 *  afirmación, qué no se pudo medir y por qué— antes de darle el OK.
 *
 *  Es un server component a propósito: los facts se renderizan en el servidor
 *  y al browser solo llega el HTML de lo que se muestra, no el objeto entero. */

export function DatosTecnicos({ facts }: { facts: FactsInterno | null | undefined }) {
  if (!facts) {
    return (
      <Bloque titulo="Datos técnicos (interno)">
        <p className="text-[0.85rem] text-tinta">
          Este diagnóstico no guardó los hechos crudos. Suele pasar con informes de una versión
          anterior del método.
        </p>
      </Bloque>
    );
  }

  const { fetch: descarga, seo, tracking, tech, dmarc, pageSpeed, contacto } = facts;

  return (
    <Bloque
      titulo="Datos técnicos (interno)"
      desc="Lo que midió el colector. No se muestra en el informe del cliente."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta titulo="Descarga del sitio">
          <Dato k="URL informada" v={facts.inputUrl} />
          <Dato k="URL final" v={facts.finalUrl ?? descarga?.finalUrl} />
          <Dato k="HTTP" v={descarga?.status} />
          <Dato k="Redirect" v={boolTexto(descarga?.redirected)} />
          <Dato k="Content-type" v={descarga?.contentType} />
          <Dato k="Tiempo de red" v={descarga?.elapsedMs ? `${descarga.elapsedMs} ms` : null} />
          <Dato k="Error" v={descarga?.error} alerta />
        </Tarjeta>

        <Tarjeta titulo="PageSpeed (móvil)">
          {pageSpeed?.disponible ? (
            <>
              {pageSpeed.puntajes ? (
                <>
                  <Dato k="Rendimiento" v={pageSpeed.puntajes.rendimiento} />
                  <Dato k="Accesibilidad" v={pageSpeed.puntajes.accesibilidad} />
                  <Dato k="Prácticas" v={pageSpeed.puntajes.practicas} />
                  <Dato k="SEO" v={pageSpeed.puntajes.seo} />
                </>
              ) : (
                <Dato k="Performance" v={pageSpeed.performance} />
              )}
              <Dato k="FCP" v={pageSpeed.fcpMs ? `${Math.round(pageSpeed.fcpMs)} ms` : null} />
              <Dato k="LCP" v={pageSpeed.lcpMs ? `${Math.round(pageSpeed.lcpMs)} ms` : null} />
              <Dato k="CLS" v={pageSpeed.cls} />
              <Dato k="TBT" v={pageSpeed.tbtMs ? `${Math.round(pageSpeed.tbtMs)} ms` : null} />
              <Dato
                k="Speed Index"
                v={pageSpeed.speedIndexMs ? `${Math.round(pageSpeed.speedIndexMs)} ms` : null}
              />
              <Dato k="Medido" v={fechaHora(pageSpeed.medidoEn)} />
              {pageSpeed.crux ? (
                <div className="mt-2 border-t border-linea2 pt-2">
                  <p className="mb-1.5 text-[0.72rem] font-semibold tracking-[0.06em] text-tinta2 uppercase">
                    Visitantes reales (CrUX, p75)
                  </p>
                  <Dato
                    k="General"
                    v={pageSpeed.crux.categoria}
                    nota={pageSpeed.crux.deTodoElDominio ? "dato del dominio entero, no de la home" : undefined}
                  />
                  <Dato
                    k="LCP"
                    v={pageSpeed.crux.lcpMs == null ? null : `${pageSpeed.crux.lcpMs} ms`}
                    nota={pageSpeed.crux.lcpCategoria ?? undefined}
                  />
                  <Dato
                    k="INP"
                    v={pageSpeed.crux.inpMs == null ? null : `${pageSpeed.crux.inpMs} ms`}
                    nota={pageSpeed.crux.inpCategoria ?? undefined}
                  />
                  <Dato k="CLS" v={pageSpeed.crux.cls} nota={pageSpeed.crux.clsCategoria ?? undefined} />
                </div>
              ) : (
                <Dato k="Visitantes reales" v="sin datos (poco tráfico para CrUX)" />
              )}
            </>
          ) : (
            // El motivo importa tanto como el número: sin esto, "no medido"
            // se confunde con "sitio lento".
            <Dato k="No se midió" v={pageSpeed?.motivo ?? "sin datos"} alerta />
          )}
        </Tarjeta>

        <Tarjeta titulo="SEO en la home">
          <Dato
            k="Title"
            v={seo?.title}
            nota={seo?.titleLength ? `${seo.titleLength} caracteres` : undefined}
          />
          <Dato
            k="Meta desc."
            v={seo?.metaDescription}
            nota={
              seo?.metaDescriptionLength ? `${seo.metaDescriptionLength} caracteres` : undefined
            }
          />
          <Dato k="H1" v={seo?.h1Count} nota={seo?.h1Texts?.join(" · ") || undefined} />
          <Dato k="lang" v={seo?.htmlLang} />
          <Dato k="Canonical" v={seo?.canonical} />
          <Dato
            k="URLs internas"
            v={seo?.urlsInternasTotal}
            nota={
              seo?.urlsCripticas
                ? `${seo.urlsCripticas} crípticas sobre ${seo.urlsInternas?.length ?? 0} analizadas`
                : undefined
            }
          />
        </Tarjeta>

        <Tarjeta titulo="Vías de contacto (home)">
          <Dato k="Estado" v={contacto?.estado?.replaceAll("_", " ")} />
          <Dato
            k="Detectadas"
            v={contacto?.viasTotal == null ? undefined : `${contacto.viasTotal} de 4`}
            nota="false = no detectado en el HTML inicial, no ausencia"
          />
          <Dato k="Motivo" v={contacto?.motivo} alerta />
          <Dato k="Widgets JS" v={contacto?.senalesJs?.join(", ")} />
          <Dato k="Teléfono tocable" v={boolTexto(contacto?.telefonoTocable)} />
          <Dato k="Teléfonos" v={contacto?.telefonos?.join(", ")} />
          <Dato k="Mail publicado" v={boolTexto(contacto?.mailPublicado)} />
          <Dato k="Mails" v={contacto?.mails?.join(", ")} />
          <Dato k="WhatsApp" v={boolTexto(contacto?.whatsapp)} />
          <Dato
            k="Formularios"
            v={
              contacto?.formulariosTotal == null
                ? undefined
                : String(contacto.formulariosTotal)
            }
          />
          <Dato
            k="Campos del form"
            v={contacto?.camposFormulario?.map((campo) => campo.nombre).join(", ")}
          />
          <Dato k="Contacto en el menú" v={boolTexto(contacto?.contactoEnMenu)} />
        </Tarjeta>

        <Tarjeta titulo="Medición detectada">
          <Dato k="GA4" v={boolTexto(tracking?.ga4)} />
          <Dato k="GTM" v={boolTexto(tracking?.gtm)} />
          <Dato k="Píxel de Meta" v={boolTexto(tracking?.metaPixel)} />
          <Dato k="Conversión Ads" v={boolTexto(tracking?.googleAdsConversion)} />
          <Dato k="UA (legacy)" v={boolTexto(tracking?.universalAnalyticsLegacy)} />
          <Dato k="IDs" v={tracking?.ids?.join(", ")} />
        </Tarjeta>

        <Tarjeta titulo="Tecnología">
          <Dato k="CMS" v={tech?.cms} />
          <Dato k="Page builder" v={tech?.pageBuilder} />
          <Dato k="Ecommerce" v={tech?.ecommerce} />
          <Dato
            k="Librerías"
            v={tech?.libraries
              ?.map((l) => `${l.nombre}${l.version ? ` ${l.version}` : ""}`)
              .join(", ")}
          />
          {tech?.evidencia?.length ? (
            <div className="mt-2 border-t border-linea2 pt-2">
              <p className="text-[0.72rem] font-semibold tracking-[0.06em] text-tinta2 uppercase">
                Evidencia
              </p>
              <ul className="mt-1.5 space-y-1">
                {tech.evidencia.map((e, i) => (
                  <li key={i} className="text-[0.8rem] text-tinta">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Tarjeta>

        <Tarjeta titulo="DMARC">
          <Dato k="Dominio" v={dmarc?.domain} />
          <Dato k="Existe" v={boolTexto(dmarc?.exists)} />
          <Dato k="Política" v={dmarc?.policy} />
          <Dato k="Subdominios" v={dmarc?.subdomainPolicy} />
          <Dato k="pct" v={dmarc?.pct} />
          <Dato k="Registro" v={dmarc?.record} />
          <Dato k="Error" v={dmarc?.error} alerta />
        </Tarjeta>
      </div>

      {pageSpeed?.disponible && pageSpeed.mejoras ? <MejorasPageSpeed mejoras={pageSpeed.mejoras} /> : null}

      {facts.warnings?.length ? (
        <div className="mt-4 rounded-card border border-linea bg-bg p-5">
          <p className="text-[0.72rem] font-semibold tracking-[0.06em] text-tinta2 uppercase">
            Warnings del colector
          </p>
          <ul className="mt-2 space-y-1.5">
            {facts.warnings.map((w, i) => (
              <li key={i} className="flex gap-2 text-[0.85rem] text-navy">
                <span aria-hidden="true" className="mt-2 block size-1.5 flex-none rounded-full bg-mid" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-[0.78rem] text-tinta2">
        Recolectado {fechaHora(facts.collectedAt) ?? "—"} · colector {facts.collectVersion ?? "?"}
      </p>
    </Bloque>
  );
}

type MejoraFacts = NonNullable<NonNullable<FactsInterno["pageSpeed"]>["mejoras"]>[number];

const CATEGORIA_PSI: Record<MejoraFacts["categoria"], string> = {
  rendimiento: "Rendimiento",
  accesibilidad: "Accesibilidad",
  practicas: "Prácticas",
  seo: "SEO",
};

/** Todas las auditorías que fallaron, con el título técnico de Lighthouse y su
 *  dato. El cliente ve hasta 6, traducidas; acá va la lista completa y se
 *  marca cuáles llegan al informe. */
function MejorasPageSpeed({ mejoras }: { mejoras: MejoraFacts[] }) {
  return (
    <div className="mt-4 rounded-card border border-linea bg-card p-5 shadow-qualita">
      <h3 className="mb-3 text-[0.72rem] font-bold tracking-[0.1em] text-magenta uppercase">
        PageSpeed · mejoras ({mejoras.length})
      </h3>
      {mejoras.length === 0 ? (
        <p className="text-[0.85rem] text-tinta">Lighthouse no marcó auditorías por debajo de 90.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[0.82rem]">
            <thead>
              <tr className="border-b border-linea text-[0.72rem] text-tinta2">
                <th className="py-1.5 pr-3 font-semibold">Categoría</th>
                <th className="py-1.5 pr-3 font-semibold">Auditoría</th>
                <th className="py-1.5 pr-3 font-semibold">Dato</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Puntaje</th>
                <th className="py-1.5 text-right font-semibold">En informe</th>
              </tr>
            </thead>
            <tbody>
              {mejoras.map((mejora) => (
                <tr key={`${mejora.categoria}-${mejora.id}`} className="border-b border-linea2 last:border-b-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-tinta">{CATEGORIA_PSI[mejora.categoria]}</td>
                  <td className="py-2 pr-3 text-navy">
                    {mejora.titulo}
                    <span className="block font-mono text-[0.7rem] text-tinta2">{mejora.id}</span>
                  </td>
                  <td className="py-2 pr-3 text-tinta">{mejora.valor ?? "—"}</td>
                  <td
                    className={`py-2 pr-3 text-right font-semibold tabular-nums ${
                      (mejora.puntaje ?? 0) < 50 ? "text-warn" : "text-mid"
                    }`}
                  >
                    {mejora.puntaje ?? "—"}
                  </td>
                  <td className="py-2 text-right text-tinta">{TEXTOS_MEJORAS[mejora.id] ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[0.76rem] text-tinta2">
        &ldquo;No&rdquo; = sin traducción a lenguaje llano en lib/diagnostico/mejorasPageSpeed.ts. El
        informe muestra hasta 6, sin repetir las que dicen lo mismo.
      </p>
    </div>
  );
}

function Bloque({
  titulo,
  desc,
  children,
}: {
  titulo: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <div className="mb-3">
        <h2 className="font-sans text-[1.05rem] font-bold text-navy">{titulo}</h2>
        {desc ? <p className="mt-0.5 text-[0.84rem] text-tinta">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-linea bg-card p-5 shadow-qualita">
      <h3 className="mb-3 text-[0.72rem] font-bold tracking-[0.1em] text-magenta uppercase">
        {titulo}
      </h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

/** Un dato que no existe no se muestra: una grilla llena de "—" no informa
 *  nada y esconde lo que sí hay. */
function Dato({
  k,
  v,
  nota,
  alerta,
}: {
  k: string;
  v: string | number | null | undefined;
  nota?: string;
  alerta?: boolean;
}) {
  if (v === null || v === undefined || v === "") return null;

  return (
    <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-0.5">
      <dt className="text-[0.78rem] text-tinta2">{k}</dt>
      <dd className={`text-[0.82rem] break-words ${alerta ? "text-warn" : "text-navy"}`}>
        {String(v)}
        {nota ? <span className="mt-0.5 block text-[0.74rem] text-tinta2">{nota}</span> : null}
      </dd>
    </div>
  );
}

function boolTexto(v: boolean | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v ? "Sí" : "No";
}

function fechaHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return null;
  return f.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}
