import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BetCommand - Domina el Juego",
  description: "La plataforma definitiva para apostadores profesionales. Análisis predictivo, gestión de capital y datos en tiempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.Node;
}>) {
  return (
    <html lang="es">
      <body className={`${geist.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
