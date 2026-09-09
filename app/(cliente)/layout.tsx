import Image from "next/image";
import Link from "next/link";

/** Shell de la vista empresa: barra de marca + contenido.
 *  El route group `(cliente)` no agrega segmento a la URL. */
export default function ClienteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-50 border-b border-linea bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[940px] items-center justify-between px-[clamp(18px,5vw,32px)]">
          <Link href="/" className="flex items-center">
            <Image
              src="/qualita-logo-navy.svg"
              alt="Qualita Studio"
              width={277}
              height={114}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <span className="hidden text-[0.8rem] font-medium text-tinta sm:block">
            Autodiagnóstico digital
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

