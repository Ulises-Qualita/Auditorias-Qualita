/** Orbes de gradiente desenfocados sobre fondo oscuro: firma visual de la
 *  marca. Decorativas, así que van con aria-hidden y sin foco. */
export function Auras() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[170px] -right-[60px] h-[440px] w-[440px] rounded-full opacity-40 blur-[90px]"
        style={{ background: "radial-gradient(circle, var(--magenta), transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[190px] -left-[120px] h-[360px] w-[360px] rounded-full opacity-30 blur-[90px]"
        style={{ background: "radial-gradient(circle, var(--coral), transparent 70%)" }}
      />
    </>
  );
}
