import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Grupo CEM — Monitoreo ambiental", template: "%s · Grupo CEM" },
  description: "Monitoreo ambiental de galpones — Carnave",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
