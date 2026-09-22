import { Fragment } from "react";
import Image from "next/image";
import { Mulish } from "next/font/google";

import type { CanalPuntuado } from "@/lib/analysis/score";
import type { Deteccion, HechosInforme } from "@/lib/diagnostico/hechos";
import {
  nivelDeScore,
  type DiagnosticResults,
  type LecturaInforme,
} from "@/lib/diagnostico/results";
import { WHATSAPP_QUALITA } from "../../_components/contacto";
import s from "./informe.module.css";

/** Las láminas del informe, una por lámina de docs/auditoria-ejemplo.html y
 *  en el mismo orden. El orden y la numeración los pone page.tsx; acá cada
 *  lámina recibe lo suyo ya resuelto.
 *
 *  Regla que atraviesa todo el archivo: lo que no se verificó se dibuja como
 *  "a validar", nunca como un cero ni como una ausencia. */

// Mulish solo para el informe: `next/font` la scopea a donde se usa la
// variable, así que el resto del sitio no la descarga.
const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const cx = (...clases: Array<string | false | null | undefined>) =>
  clases.filter(Boolean).join(" ");

/* ================================================================== */
/* Primitivas                                                          */
/* ================================================================== */

export function Mazo({
  mock,
  children,
}: {
  mock: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${mulish.variable} ${s.deck}`}>
      {mock && (
        <div className={s.mock}>
          Vista de prueba · datos mock, no es un diagnóstico real
        </div>
      )}
      <div className={s.mazo}>{children}</div>
    </div>
  );
}

type Tono = "light" | "dark";

type Comun = { empresa: string; pg: number };

function Lamina({
  tono,
  empresa,
  pg,
  kicker,
  titulo,
  sub,
  subItalica = false,
  arriba = false,
  conclusion,
  children,
}: Comun & {
  tono: Tono;
  kicker: string;
  titulo: React.ReactNode;
  sub?: React.ReactNode;
  subItalica?: boolean;
  /** El contenido arranca arriba en vez de centrarse (láminas densas). */
  arriba?: boolean;
  conclusion?: string | null;
  children: React.ReactNode;
}) {
  const oscuro = tono === "dark";
  return (
    <section className={cx(s.slide, oscuro ? s.dark : s.light)}>
      <div className={s.pad}>
        <div className={s.eyebrow}>{kicker}</div>
        <h2 className={s.h1}>{titulo}</h2>
        {oscuro ? (
          <Image
            className={cx(s.logo, s.iso)}
            src="/qualita-isotipo.png"
            alt="Qualita"
            width={488}
            height={503}
          />
        ) : (
          <Image
            className={s.logo}
            src="/qualita-logo-navy.svg"
            alt="qualita studio"
            width={277}
            height={114}
          />
        )}
        {sub && <p className={cx(s.sub, subItalica && s.it)}>{sub}</p>}
        <div className={cx(s.body, arriba && s.bodyArriba)}>{children}</div>
        {conclusion && (
          <div className={s.concl}>
            <div className={s.lbl}>Conclusión</div>
            <div className={s.txt}>{conclusion}</div>
          </div>
        )}
        <div className={s.foot}>
          <span>Qualita Studio para {empresa} · hola@qualita.studio</span>
          <span className={s.pg}>{pg}</span>
        </div>
      </div>
    </section>
  );
}

function Viñetas({ items }: { items: string[] }) {
  return (
    <ul className={s.b}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** "41K" → 41000, "9.637" → 9637, "9,6K" → 9600, "~35" → 35, "4,5" → 4.5.
 *  null si no hay número: esa barra se dibuja "a validar". */
export function aNumero(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const limpio = valor
    .trim()
    .toLowerCase()
    .replace(/[~≈+\s]/g, "");
  const m = limpio.match(
    /^(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?|\d+(?:\.\d+)?)(k|mil|m)?/,
  );
  if (!m) return null;
  let base = m[1];
  // "9.637" es miles con punto; "9,6" es decimal con coma.
  base = /^\d{1,3}(\.\d{3})+$/.test(base)
    ? base.replace(/\./g, "")
    : base.replace(",", ".");
  const numero = Number.parseFloat(base);
  if (!Number.isFinite(numero)) return null;
  const mult =
    m[2] === "k" || m[2] === "mil" ? 1_000 : m[2] === "m" ? 1_000_000 : 1;
  return numero * mult;
}

type Barra = {
  nombre: string;
  valor: string | null | undefined;
  destacada?: boolean;
};

/** Un gráfico de barras horizontales. El ancho es relativo al mayor valor. */
function Barras({
  titulo,
  magenta = false,
  barras,
  colorBase,
  colorDestacado,
  nota,
}: {
  titulo: string;
  magenta?: boolean;
  barras: Barra[];
  colorBase: string;
  colorDestacado: string;
  nota?: string | null;
}) {
  const numeros = barras.map((barra) => aNumero(barra.valor));
  const maximo = Math.max(0, ...numeros.map((n) => n ?? 0));

  return (
    <div>
      <div className={cx(s.ct, magenta && s.ctMg)}>{titulo}</div>
      <div className={s.bars}>
        {barras.map((barra, i) => {
          const n = numeros[i];
          const ancho =
            n !== null && maximo > 0
              ? Math.max((n / maximo) * 100, n > 0 ? 2 : 0)
              : 0;
          return (
            <div className={s.bar} key={`${barra.nombre}-${i}`}>
              <span className={s.lab} title={barra.nombre}>
                {barra.nombre}
              </span>
              <div className={s.track}>
                {ancho > 0 && (
                  <div
                    className={cx(
                      s.fill,
                      barra.destacada ? colorDestacado : colorBase,
                    )}
                    style={{
                      width: `calc(${ancho}% - ${ancho > 80 ? 4 : 0}em)`,
                    }}
                  />
                )}
                <span className={cx(s.val, n === null && s.valPend)}>
                  {n === null ? "a validar" : barra.valor}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {nota && <div className={s.note}>{nota}</div>}
    </div>
  );
}

/* ================================================================== */
/* 1. Portada                                                          */
/* ================================================================== */

export function Portada({
  empresa,
  tesis,
  competidores,
  fuente,
  score,
  preliminar,
}: {
  empresa: string;
  tesis: { titular: string; bajada: string };
  competidores: string[];
  fuente: string;
  score: number | null;
  preliminar: boolean;
}) {
  const nivel = score === null ? null : nivelDeScore(score);
  const claseNivel =
    nivel?.id === "inicial"
      ? s.nivelInicial
      : nivel?.id === "en_desarrollo"
        ? s.nivelDesarrollo
        : s.nivelSolido;

  return (
    <section className={cx(s.slide, s.cover)}>
      <div className={s.pad}>
        <Image
          className={s.isoLogo}
          src="/qualita-isotipo.png"
          alt="Qualita"
          width={488}
          height={503}
          priority
        />
        <div className={s.coverGrid}>
          <div>
            <div className={s.kicker}>
              <span>
                Qualita Studio · Diagnóstico digital
                {competidores.length > 0 ? " y benchmark" : ""}
              </span>
              {preliminar && <span className={s.revision}>En revisión</span>}
            </div>
            <h1 className={cx(s.big, empresa.length > 16 && s.bigLargo)}>
              {empresa}
            </h1>
            <p className={s.tag}>
              {tesis.titular} {tesis.bajada}
            </p>
            {competidores.length > 0 && (
              <p className={s.bench}>Benchmark: {competidores.join(" · ")}</p>
            )}
            <p className={s.src}>{fuente}</p>
          </div>

          <div className={s.score100}>
            <div className={s.scoreFila}>
              <div>
                <span className={s.scoreNum}>{score ?? "—"}</span>
                <span className={s.scoreDe}>/100</span>
              </div>
              <div className={s.scoreLbl}>
                Madurez digital
                <br />
                <span className={cx(s.nivel, nivel && claseNivel)}>
                  {nivel ? `Nivel ${nivel.label}` : "Sin calcular"}
                </span>
              </div>
            </div>
            {score !== null && (
              <>
                <div className={s.escala}>
                  <span
                    aria-hidden="true"
                    className={s.marca}
                    style={{ left: `${score}%` }}
                  />
                </div>
                <div className={s.escalaRotulos}>
                  <span>Inicial</span>
                  <span>En desarrollo</span>
                  <span>Sólido</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 2. Alcance                                                          */
/* ================================================================== */

export function Alcance({
  empresa,
  pg,
  conclusion,
}: Comun & { conclusion: string | null }) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Alcance"
      titulo="Por dónde entra una consulta y dónde se decide si sirve"
      conclusion={conclusion}
    >
      <div className={s.flow}>
        <div className={s.chan}>
          <div className={s.chip}>Google orgánico</div>
          <div className={s.chip}>Google Ads</div>
          <div className={s.chip}>Meta Ads</div>
          <div className={s.chip}>Redes + ficha de Google</div>
        </div>
        <div className={s.arcol} aria-hidden="true">
          <span className={s.ar}>→</span>
          <span className={s.ar}>→</span>
          <span className={s.ar}>→</span>
          <span className={s.ar}>→</span>
        </div>
        <div className={s.site}>
          <h3>SITIO WEB</h3>
          <p>
            Acá aterriza todo.
            <br />
            ¿Recibe la consulta?
            <br />
            ¿La califica?
            <br />
            ¿La mide?
          </p>
        </div>
        <div className={s.midar} aria-hidden="true">
          →
        </div>
        <div className={s.dato}>
          <h3>DATO</h3>
          <p>
            Una consulta registrada, con origen, tipo de comprador y volumen.
            <br />
            <br />
            Es lo que permite saber qué rinde y qué no.
          </p>
        </div>
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 3. Punto de partida                                                 */
/* ================================================================== */

export function PuntoDePartida({
  empresa,
  pg,
  activos,
  conclusion,
}: Comun & {
  activos: DiagnosticResults["activos"];
  conclusion: string | null;
}) {
  // Si algún dato es largo, todos bajan de tamaño: lado a lado tienen que
  // verse iguales.
  const largo = Math.max(...activos.map((activo) => activo.dato.length));
  return (
    <Lamina
      tono="dark"
      empresa={empresa}
      pg={pg}
      kicker="Punto de partida"
      titulo={`Lo que ${empresa} ya tiene en marcha`}
      conclusion={conclusion}
    >
      <div className={s.stats}>
        {activos.map((activo, i) => (
          <div className={s.stat} key={i}>
            <div className={cx(s.statN, largo > 10 && s.statNChico)}>
              {activo.dato}
            </div>
            <div className={s.statD}>{activo.etiqueta}</div>
          </div>
        ))}
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 4. La pregunta que ordena                                           */
/* ================================================================== */

export function Pregunta({
  empresa,
  pg,
  escena,
  pasos,
}: Comun & {
  escena: NonNullable<DiagnosticResults["escena"]>;
  pasos: DiagnosticResults["recorrido"];
}) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="La pregunta que ordena"
      titulo={escena.pregunta}
      sub={escena.necesidad}
      subItalica
      conclusion={escena.conclusion}
    >
      <div className={cx(s.stepwrap, pasos.length === 3 && s.stepwrap3)}>
        {pasos.map((paso, i) => {
          const ultimo = i === pasos.length - 1;
          return (
            <Fragment key={i}>
              <div className={cx(s.step, ultimo && s.stepDk)}>
                <div className={s.stepTop}>
                  <span className={s.num}>{i + 1}</span>
                  <span className={s.stt}>{paso.paso}</span>
                </div>
                <div className={s.sb}>{paso.detalle}</div>
              </div>
              {!ultimo && (
                <div className={s.sar} aria-hidden="true">
                  →
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
      {escena.cita && (
        <div className={s.quote}>
          “{escena.cita.texto}” — {escena.cita.origen}
        </div>
      )}
    </Lamina>
  );
}

/* ================================================================== */
/* 5. Sitio web · Cómo aparece en Google                               */
/* ================================================================== */

export function Titulos({
  empresa,
  pg,
  bloque,
}: Comun & { bloque: NonNullable<DiagnosticResults["titulos"]> }) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Sitio web · Cómo aparece en Google"
      titulo={bloque.titulo}
      sub={bloque.bajada}
      conclusion={bloque.conclusion}
    >
      <div className={s.cmp}>
        <div className={s.cmpVacio} />
        <div className={s.cmpColh}>HOY · lo que Google muestra</div>
        <div className={s.cmpVacio} />
        <div className={s.cmpColh}>DEBERÍA · lo que el comprador leería</div>
        {bloque.filas.map((fila, i) => (
          <Fragment key={i}>
            <div className={s.rh}>{fila.pagina}</div>
            <div className={s.now}>{fila.hoy}</div>
            <div className={s.a} aria-hidden="true">
              →
            </div>
            <div className={s.should}>{fila.deberia}</div>
          </Fragment>
        ))}
      </div>
      {bloque.nota && <div className={s.note}>{bloque.nota}</div>}
    </Lamina>
  );
}

/* ================================================================== */
/* 6. Sitio web · Home                                                 */
/* ================================================================== */

export function Home({
  empresa,
  pg,
  bloque,
}: Comun & { bloque: NonNullable<DiagnosticResults["home"]> }) {
  return (
    <Lamina
      tono="dark"
      empresa={empresa}
      pg={pg}
      kicker="Sitio web · Home"
      titulo={bloque.titulo}
      conclusion={bloque.conclusion}
    >
      <div className={cx(s.two, !bloque.escondido && s.twoArriba)}>
        <div className={s.panel}>
          <h3>Lo que ve quien entra</h3>
          <Viñetas items={bloque.ve_quien_entra} />
          {bloque.a_corregir && (
            <>
              <div className={s.sh}>{bloque.a_corregir.titulo}</div>
              <Viñetas items={bloque.a_corregir.items} />
            </>
          )}
        </div>
        {bloque.escondido && (
          <div className={s.panel}>
            <h3>Lo que solo está en {bloque.escondido.donde}</h3>
            <div className={s.minigrid}>
              {bloque.escondido.datos.map((dato, i) => (
                <div key={i}>
                  <div className={s.miniN}>{dato.dato}</div>
                  <div className={s.miniD}>{dato.etiqueta}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 7. Sitio web · Modelo                                               */
/* ================================================================== */

export function Modelo({
  empresa,
  pg,
  bloque,
}: Comun & { bloque: NonNullable<DiagnosticResults["modelo"]> }) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Sitio web · Modelo"
      titulo={bloque.titulo}
      arriba
      conclusion={bloque.conclusion}
    >
      <div className={cx(s.two, s.twoArriba, s.twoModelo)}>
        <div>
          <div className={s.colhead} style={{ color: "var(--magenta)" }}>
            {bloque.mecanica_titulo}
          </div>
          <div className={s.mech}>
            {bloque.mecanica.map((par, i) => (
              <Fragment key={i}>
                <div className={s.k}>{par.k}</div>
                <div className={s.v}>{par.v}</div>
              </Fragment>
            ))}
          </div>
        </div>
        <div className={s.real}>
          <h3>Cómo compra en realidad el cliente</h3>
          {bloque.compra_real.map((paso, i) => (
            <div className={s.realRow} key={i}>
              <span className={s.realNum}>{i + 1}</span>
              <span className={s.realT}>{paso}</span>
            </div>
          ))}
        </div>
      </div>
      {bloque.nota && <div className={s.note}>{bloque.nota}</div>}
    </Lamina>
  );
}

/* ================================================================== */
/* 8. Sitio web · Captación                                            */
/* ================================================================== */

type Formulario = NonNullable<DiagnosticResults["captacion"]>["propio"];

function TarjetaFormulario({
  form,
  oscuro,
}: {
  form: Formulario;
  oscuro: boolean;
}) {
  return (
    <div className={cx(s.capt, oscuro && s.captDk)}>
      <h3>{form.etiqueta}</h3>
      <div className={s.fgrid}>
        {form.campos.map((campo, i) => (
          <div className={cx(s.fld, campo.destacado && s.fldC)} key={i}>
            {campo.texto}
          </div>
        ))}
      </div>
      <div className={s.cnote}>{form.nota}</div>
    </div>
  );
}

export function Captacion({
  empresa,
  pg,
  bloque,
}: Comun & { bloque: NonNullable<DiagnosticResults["captacion"]> }) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Sitio web · Captación"
      titulo={bloque.titulo}
      conclusion={bloque.conclusion}
    >
      <div className={s.two}>
        <TarjetaFormulario form={bloque.propio} oscuro={false} />
        {bloque.competidor ? (
          <TarjetaFormulario form={bloque.competidor} oscuro />
        ) : (
          <div className={cx(s.capt, s.captDk)}>
            <h3>Competencia</h3>
            <p className={s.captVacio}>
              No leímos un formulario de la competencia para comparar. Queda a
              validar.
            </p>
          </div>
        )}
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 9. Arquitectura                                                     */
/* ================================================================== */

const MARCA_EJE = {
  si: ["✓", s.chk],
  parcial: ["!", s.med],
  no: ["✕", s.crs],
} as const;

export function Estructura({
  empresa,
  pg,
  bloque,
}: Comun & { bloque: NonNullable<DiagnosticResults["estructura"]> }) {
  return (
    <Lamina
      tono="dark"
      empresa={empresa}
      pg={pg}
      kicker="Arquitectura"
      titulo={bloque.titulo}
      conclusion={bloque.conclusion}
    >
      <div className={cx(s.three, bloque.ejes.length === 2 && s.twoCols)}>
        {bloque.ejes.map((eje, i) => {
          const [simbolo, clase] = MARCA_EJE[eje.tiene];
          return (
            <div className={s.acard} key={i}>
              <div className={s.eh}>{eje.eje}</div>
              <div className={s.st}>
                <span className={clase}>{simbolo}</span> {eje.estado}
              </div>
              <Viñetas items={eje.items} />
            </div>
          );
        })}
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 10. Google orgánico                                                 */
/* ================================================================== */

type Seo = NonNullable<DiagnosticResults["seo"]>;

function FilaRanking({ ranking }: { ranking: Seo["rankings"][number] }) {
  const simbolo =
    ranking.aparece === "si" ? "✓" : ranking.aparece === "no" ? "✕" : "?";
  const claseIc =
    ranking.aparece === "si" ? s.chk : ranking.aparece === "no" ? s.crs : s.med;
  const claseR =
    ranking.aparece === "si" ? s.rMg : ranking.aparece === "no" ? s.rCo : s.rMu;
  const texto =
    ranking.posicion ??
    (ranking.aparece === "si"
      ? "aparece"
      : ranking.aparece === "no"
        ? "no aparece"
        : "a validar");
  return (
    <div className={s.qrow}>
      <span className={cx(s.ic, claseIc)}>{simbolo}</span>
      <span className={s.q}>“{ranking.keyword}”</span>
      <span className={cx(s.r, claseR)}>{texto}</span>
    </div>
  );
}

export function Organico({ empresa, pg, seo }: Comun & { seo: Seo }) {
  const a = seo.rankings.filter((r) => r.grupo !== "b");
  const b = seo.rankings.filter((r) => r.grupo === "b");
  const columnas: Array<[string, Seo["rankings"]]> = [
    [seo.grupo_a ?? "Donde ya aparece", a],
    [seo.grupo_b ?? "Donde todavía no", b],
  ];
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Google orgánico"
      titulo={seo.titulo}
      arriba
      conclusion={seo.conclusion}
    >
      <div className={s.org}>
        {columnas
          .filter(([, filas]) => filas.length > 0)
          .map(([titulo, filas]) => (
            <div className={s.orgCol} key={titulo}>
              <div className={s.ch}>{titulo}</div>
              {filas.map((ranking, j) => (
                <FilaRanking ranking={ranking} key={j} />
              ))}
            </div>
          ))}
      </div>
      {seo.nota && <div className={s.note}>{seo.nota}</div>}
    </Lamina>
  );
}

/* ================================================================== */
/* 11. Google Ads                                                      */
/* ================================================================== */

type Pauta = NonNullable<DiagnosticResults["google_ads"]>;

const aBarras = (barras: NonNullable<Pauta["comparativa"]>): Barra[] =>
  barras.map((barra) => ({
    nombre: barra.nombre,
    valor: barra.valor,
    destacada: barra.propio,
  }));

export function GoogleAds({ empresa, pg, pauta }: Comun & { pauta: Pauta }) {
  const comparativa = pauta.comparativa ?? [];
  const anunciantes = pauta.anunciantes ?? [];
  return (
    <Lamina
      tono="dark"
      empresa={empresa}
      pg={pg}
      kicker="Google Ads"
      titulo={pauta.titulo}
      conclusion={pauta.conclusion}
    >
      <div className={cx(s.two, s.twoArriba)}>
        {comparativa.length > 0 ? (
          <Barras
            titulo={
              pauta.comparativa_titulo ??
              "Anuncios en el Centro de Transparencia (AR)"
            }
            barras={aBarras(comparativa)}
            colorBase={s.fLv}
            colorDestacado={s.fCo}
            nota={anunciantes.length > 0 ? pauta.nota : null}
          />
        ) : (
          <div className={cx(s.infobox, s.infoboxDk)} style={{ marginTop: 0 }}>
            <h3>Lo que se vio</h3>
            <p>{pauta.hallazgo}</p>
          </div>
        )}
        {anunciantes.length > 0 ? (
          <Barras
            titulo={
              pauta.anunciantes_titulo ??
              "Quiénes sí pautan en las búsquedas del comprador"
            }
            barras={aBarras(anunciantes)}
            colorBase={s.fMg}
            colorDestacado={s.fCo}
          />
        ) : (
          <div>{pauta.nota && <div className={s.note}>{pauta.nota}</div>}</div>
        )}
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 12. Meta Ads                                                        */
/* ================================================================== */

export function MetaAds({ empresa, pg, pauta }: Comun & { pauta: Pauta }) {
  const comparativa = pauta.comparativa ?? [];
  const destinos = pauta.destinos ?? [];
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Meta Ads"
      titulo={pauta.titulo}
      conclusion={pauta.conclusion}
    >
      <div className={cx(s.two, s.twoArriba)}>
        {comparativa.length > 0 ? (
          <Barras
            titulo={
              pauta.comparativa_titulo ??
              "Anuncios activos en la Biblioteca de Meta (AR)"
            }
            magenta
            barras={aBarras(comparativa)}
            colorBase={s.fNv}
            colorDestacado={s.fMg}
            nota={pauta.nota}
          />
        ) : (
          <div className={s.infobox}>
            <h3>Lo que se vio</h3>
            <p>{pauta.hallazgo}</p>
            {pauta.nota && <div className={s.note}>{pauta.nota}</div>}
          </div>
        )}
        <div>
          {destinos.length > 0 && (
            <div className={s.infobox}>
              <h3>A dónde llevan el clic</h3>
              {destinos.map((destino, i) => (
                <p key={i}>{destino}</p>
              ))}
            </div>
          )}
          {pauta.explicacion && (
            <div
              className={cx(s.infobox, s.infoboxDk)}
              style={destinos.length === 0 ? { marginTop: 0 } : undefined}
            >
              <h3>{pauta.explicacion.titulo}</h3>
              <p>{pauta.explicacion.texto}</p>
            </div>
          )}
        </div>
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 13. Redes y ficha de Google                                         */
/* ================================================================== */

export function RedesFicha({
  empresa,
  pg,
  bloque,
  seguidores,
  resenas,
}: Comun & {
  bloque: NonNullable<DiagnosticResults["redes_ficha"]>;
  seguidores: Barra[];
  resenas: Barra[];
}) {
  const hayNumeros = (barras: Barra[]) =>
    barras.some((barra) => aNumero(barra.valor) !== null);
  const ordenar = (barras: Barra[]) =>
    [...barras].sort(
      (x, y) => (aNumero(y.valor) ?? -1) - (aNumero(x.valor) ?? -1),
    );
  return (
    <Lamina
      tono="dark"
      empresa={empresa}
      pg={pg}
      kicker="Redes y ficha de Google"
      titulo={bloque.titulo}
      conclusion={bloque.conclusion}
    >
      <div className={cx(s.two, s.twoArriba)}>
        {hayNumeros(seguidores) && (
          <Barras
            titulo="Seguidores en Instagram"
            barras={ordenar(seguidores)}
            colorBase={s.fLv}
            colorDestacado={s.fCo}
          />
        )}
        {hayNumeros(resenas) && (
          <Barras
            titulo="Reseñas en la ficha de Google"
            barras={ordenar(resenas)}
            colorBase={s.fLv}
            colorDestacado={s.fCo}
          />
        )}
      </div>
      {bloque.nota && <div className={s.note}>{bloque.nota}</div>}
    </Lamina>
  );
}

/* ================================================================== */
/* 14. Medición                                                        */
/* ================================================================== */

type Celda = "si" | "no" | "?";

export type ColumnaMedicion = {
  nombre: string;
  celdas: Record<FilaMedicion, Celda>;
};
export type FilaMedicion = "ga4" | "gtm" | "pixel" | "ads" | "dmarc";

const FILAS_MEDICION: Array<[FilaMedicion, string]> = [
  ["ga4", "Google Analytics 4"],
  ["gtm", "Google Tag Manager"],
  ["pixel", "Píxel de Meta"],
  ["ads", "Conversión de Google Ads"],
  ["dmarc", "Correo protegido (DMARC)"],
];

const deDeteccion = (d: Deteccion): Celda =>
  d === "detectado" ? "si" : d === "no_detectado" ? "no" : "?";

const dmarcProtegido = (
  existe: boolean | null | undefined,
  politica: string | null | undefined,
): Celda => {
  if (existe === null || existe === undefined) return "?";
  if (!existe) return "no";
  return politica === "quarantine" || politica === "reject" ? "si" : "no";
};

/** La columna de la empresa sale de los facts de su home. */
export function columnaPropia(
  nombre: string,
  hechos: HechosInforme,
): ColumnaMedicion {
  const m = hechos.medicion;
  return {
    nombre,
    celdas: {
      ga4: deDeteccion(m.ga4),
      gtm: deDeteccion(m.gtm),
      pixel: deDeteccion(m.metaPixel),
      ads: deDeteccion(m.googleAdsConversion),
      dmarc: dmarcProtegido(hechos.dmarc?.existe, hechos.dmarc?.politica),
    },
  };
}

/** La de un competidor, de lo que leyó `leer_pagina` de su home. Sin
 *  lectura, la columna entera es "a validar". */
export function columnaCompetidor(
  nombre: string,
  lectura: LecturaInforme | null,
): ColumnaMedicion {
  const t = lectura?.ok ? lectura.tracking : null;
  const tag = (valor: boolean | undefined): Celda =>
    t ? (valor ? "si" : "no") : "?";
  return {
    nombre,
    celdas: {
      ga4: tag(t?.ga4),
      gtm: tag(t?.gtm),
      pixel: tag(t?.metaPixel),
      ads: tag(t?.googleAdsConversion),
      dmarc: dmarcProtegido(lectura?.dmarc?.exists, lectura?.dmarc?.policy),
    },
  };
}

const SIMBOLO: Record<Celda, [string, string, string]> = {
  si: ["✓", s.chk, "detectado"],
  no: ["✕", s.crs, "no detectado"],
  "?": ["—", s.med, "a validar"],
};

export function Medicion({
  empresa,
  pg,
  bloque,
  columnas,
}: Comun & {
  bloque: NonNullable<DiagnosticResults["medicion_deck"]>;
  columnas: ColumnaMedicion[];
}) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Medición"
      titulo={bloque.titulo}
      conclusion={bloque.conclusion}
    >
      <div className={s.tablaScroll}>
        <table className={s.tbl}>
          <thead>
            <tr>
              <th />
              {columnas.map((columna) => (
                <th className={s.tc} key={columna.nombre}>
                  {columna.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FILAS_MEDICION.map(([fila, rotulo]) => (
              <tr key={fila}>
                <td>{rotulo}</td>
                {columnas.map((columna) => {
                  const [simbolo, clase, texto] = SIMBOLO[columna.celdas[fila]];
                  return (
                    <td
                      className={cx(s.tc, clase)}
                      key={columna.nombre}
                      title={texto}
                    >
                      <span aria-label={texto}>{simbolo}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={s.note}>
        {bloque.nota ? `${bloque.nota} ` : ""}✓ detectado · ✕ no detectado en el
        código de la home (puede cargar por JavaScript) · — a validar.
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 15. Mapa del sector                                                 */
/* ================================================================== */

type Celdas = NonNullable<DiagnosticResults["sector"]>["propio"];

export function Sector({
  empresa,
  pg,
  bloque,
  filas,
}: Comun & {
  bloque: NonNullable<DiagnosticResults["sector"]>;
  filas: Array<{ nombre: string; celdas: Celdas | null }>;
}) {
  const celda = (valor: string | undefined) => valor ?? "a validar";
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Mapa del sector"
      titulo={bloque.titulo}
      conclusion={bloque.conclusion}
    >
      <div className={s.tablaScroll}>
        <table className={s.sect}>
          <thead>
            <tr>
              <th />
              <th>Google Ads</th>
              <th>Meta Ads</th>
              <th>Instagram</th>
              <th>Ficha Google</th>
              <th>Sitio y captación</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...filas.map((fila) => ({ ...fila, propio: false })),
              { nombre: empresa, celdas: bloque.propio, propio: true },
            ].map((fila, i) => (
              <tr className={fila.propio ? s.hl : undefined} key={i}>
                <td>{fila.nombre}</td>
                <td>{celda(fila.celdas?.google_ads)}</td>
                <td>{celda(fila.celdas?.meta_ads)}</td>
                <td>{celda(fila.celdas?.instagram)}</td>
                <td>{celda(fila.celdas?.ficha)}</td>
                <td>{celda(fila.celdas?.sitio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={s.badge2}>
        <div className={s.ub}>
          <h4>Urgencia</h4>
          <p>{bloque.urgencia}</p>
        </div>
        <div className={s.ub}>
          <h4>Oportunidad</h4>
          <p>{bloque.oportunidad}</p>
        </div>
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 16. Score por canal                                                 */
/* ================================================================== */

export function ScorePorCanal({
  empresa,
  pg,
  canales,
  conclusion,
}: Comun & { canales: CanalPuntuado[]; conclusion: string | null }) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Score por canal"
      titulo="Madurez de cada canal, de 1 (ausente) a 5 (profesional y sostenido)"
      conclusion={conclusion}
    >
      <div className={s.score}>
        {canales.map((canal) => (
          <Fragment key={canal.clave}>
            <div className={s.chn}>{canal.rotulo}</div>
            <div className={s.dots}>
              {[1, 2, 3, 4, 5].map((punto) => (
                <span
                  key={punto}
                  className={cx(
                    s.dot,
                    canal.madurez === null && s.dotPend,
                    canal.madurez !== null &&
                      punto <= canal.madurez &&
                      (canal.madurez === 1 ? s.dotOn1 : s.dotOn),
                  )}
                />
              ))}
              <span className={cx(s.sc, canal.madurez === null && s.scPend)}>
                {canal.madurez === null ? "a validar" : `${canal.madurez} / 5`}
              </span>
            </div>
            <div className={s.sd}>{canal.detalle}</div>
          </Fragment>
        ))}
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 17. El método Qualita                                               */
/* ================================================================== */

/** Los nombres fijos del método, en su orden. También los lista el cierre. */
export const PASOS_METODO = [
  "Diagnóstico y arquitectura",
  "Sitio que convierte",
  "Medición unificada",
  "Captación que califica",
  "Comunicación y marca",
  "Publicidad que alimenta",
] as const;

export function Metodo({
  empresa,
  pg,
  plan,
  conclusion,
}: Comun & { plan: DiagnosticResults["plan"]; conclusion: string | null }) {
  // Con los 6 pasos del método van los nombres fijos; un informe viejo con
  // menos pasos muestra los títulos que escribió el modelo.
  const completos = plan.length === PASOS_METODO.length;
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="El método Qualita"
      titulo="Cómo se construye el sistema que hoy no existe, en seis pasos"
      conclusion={conclusion}
    >
      <div className={s.m6}>
        {plan.map((paso, i) => (
          <div
            className={cx(s.mcard, i === plan.length - 1 && s.mcardCo)}
            key={i}
          >
            <div className={s.mTop}>
              <span className={s.mNum}>{i + 1}</span>
              <span className={s.mt}>
                {completos ? PASOS_METODO[i] : paso.titulo}
              </span>
            </div>
            <div className={s.mb}>{paso.detalle}</div>
          </div>
        ))}
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 18. Síntesis                                                        */
/* ================================================================== */

export function Sintesis({
  empresa,
  pg,
  bloque,
}: Comun & { bloque: NonNullable<DiagnosticResults["sintesis"]> }) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Síntesis"
      titulo={bloque.titulo}
      conclusion={bloque.conclusion}
    >
      <div className={s.synth}>
        <div className={s.scard}>
          <h3>Lo que {empresa} tiene</h3>
          <Viñetas items={bloque.tiene} />
        </div>
        <div className={s.scard}>
          <h3>Lo que le falta</h3>
          <Viñetas items={bloque.falta} />
        </div>
        <div className={s.scard}>
          <h3>Dónde está la oportunidad</h3>
          <Viñetas items={bloque.oportunidad} />
        </div>
      </div>
    </Lamina>
  );
}

/* ================================================================== */
/* 19. Nota de método                                                  */
/* ================================================================== */

export function NotaMetodo({
  empresa,
  pg,
  fecha,
  fuentes,
  aValidar,
  conclusion,
}: Comun & {
  fecha: string;
  fuentes: Array<[string, string]>;
  aValidar: string | null;
  conclusion: string | null;
}) {
  return (
    <Lamina
      tono="light"
      empresa={empresa}
      pg={pg}
      kicker="Nota de método"
      titulo="Fuentes, fecha y lo que queda por validar"
      conclusion={conclusion}
    >
      <table className={s.mtbl}>
        <thead>
          <tr>
            <th>Canal</th>
            <th>Fuente{fecha ? ` (todo relevado el ${fecha})` : ""}</th>
          </tr>
        </thead>
        <tbody>
          {fuentes.map(([canal, fuente]) => (
            <tr key={canal}>
              <td>{canal}</td>
              <td>{fuente}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {aValidar && <div className={s.srcbox}>{aValidar}</div>}
    </Lamina>
  );
}

/* ================================================================== */
/* 20. Cierre                                                          */
/* ================================================================== */

export function Cierre({
  empresa,
  mesAnio,
}: {
  empresa: string;
  mesAnio: string;
}) {
  return (
    <section className={cx(s.slide, s.close)}>
      <div className={s.pad}>
        <Image
          className={s.isoLogo}
          src="/qualita-isotipo.png"
          alt="Qualita"
          width={488}
          height={503}
        />
        <h2 className={s.closeBig}>Qualita Studio para {empresa}</h2>
        <p className={s.steps6}>
          {PASOS_METODO.slice(0, -1).join(" · ")} · Publicidad que alimenta el
          sistema
        </p>
        <a
          className={s.cta}
          href={WHATSAPP_QUALITA}
          target="_blank"
          rel="noopener noreferrer"
        >
          Hablar con Qualita por WhatsApp →
        </a>
        <p className={s.mail}>hola@qualita.studio</p>
        <p className={s.loc}>
          Bahía Blanca, Argentina{mesAnio ? ` · ${mesAnio.toLowerCase()}` : ""}
        </p>
      </div>
    </section>
  );
}
