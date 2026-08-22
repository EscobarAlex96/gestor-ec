import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "GestorEC — Gestión Administrativa Ecuador",
  description:
    "Sistema de gestión administrativa: proyectos, finanzas, facturación electrónica y cumplimiento SRI Ecuador.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-slate-100">
        <div className="flex min-h-screen">
          <Shell>{children}</Shell>
        </div>
      </body>
    </html>
  );
}
