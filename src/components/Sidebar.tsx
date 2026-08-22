"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Building2, ClipboardList, FileText, Landmark, Settings, Wallet,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/proyectos", label: "Proyectos", icon: ClipboardList },
  { href: "/finanzas/facturas", label: "Facturación", icon: FileText },
  { href: "/finanzas/gastos", label: "Gastos y compras", icon: Wallet },
  { href: "/finanzas/impuestos", label: "Impuestos SRI", icon: Landmark },
  { href: "/registros", label: "Registros", icon: Building2 },
  { href: "/cumplimiento", label: "Cumplimiento", icon: Landmark },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar({ razonSocial, regimen }: { razonSocial: string; regimen: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 md:flex">
      <div className="border-b border-slate-800 px-5 py-4">
        <p className="text-sm font-bold tracking-wide text-white">GestorEC</p>
        <p className="truncate text-xs text-slate-400" title={razonSocial}>{razonSocial}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-indigo-400">{regimen}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const activo = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activo ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 px-5 py-3">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Normativa SRI Ecuador · Tarifas vigentes 2026
        </p>
      </div>
    </aside>
  );
}
