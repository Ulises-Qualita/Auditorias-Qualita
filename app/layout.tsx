import type { Metadata } from "next";
import { Unbounded, DM_Sans } from "next/font/google";
import "./globals.css";

// Unbounded: solo títulos, números grandes y destacados.
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// DM Sans: todo el cuerpo, labels, tablas y botones.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Autodiagnóstico Digital — Qualita Studio",
  description:
    "Descubrí cómo se ve tu empresa online: un diagnóstico de tu presencia digital hecho sobre información pública verificable.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${unbounded.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
