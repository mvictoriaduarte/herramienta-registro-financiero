import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { AmbientBackground } from "@/components/AmbientBackground";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Registro financiero",
  description: "Seguí tus ingresos y gastos en un perfil privado.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="relative min-h-full font-sans text-ink">
        <AmbientBackground />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
