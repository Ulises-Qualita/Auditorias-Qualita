import type { FactsInterno } from "@/lib/consola/facts";

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

  const { fetch: descarga, seo, tracking, tech, dmarc, pageSpeed } = facts;

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
              <Dato k="Performance" v={pageSpeed.performance} />
              <Dato k="LCP" v={pageSpeed.lcpMs ? `${Math.round(pageSpeed.lcpMs)} ms` : null} />
              <Dato k="CLS" v={pageSpeed.cls} />
              <Dato k="TBT" v={pageSpeed.tbtMs ? `${Math.round(pageSpeed.tbtMs)} ms` : null} />
              <Dato k="Medido" v={fechaHora(pageSpeed.medidoEn)} />
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
