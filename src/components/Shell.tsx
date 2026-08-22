"use client";

import { Sidebar } from "@/components/Sidebar";
import { useHydrated } from "@/components/ui";
import { useGestor } from "@/lib/store";

const REGIMEN_LABEL: Record<string, string> = {
  RIMPE_EMPRENDEDOR: "RIMPE Emprendedor",
  RIMPE_RENTABLE: "RIMPE Emprendimiento Rentable",
  GENERAL: "Régimen General",
};

export function Shell({ children }: { children: React.ReactNode }) {
  const hidratado = useHydrated();
  const company = useGestor((s) => s.company);
  return (
    <>
      {hidratado ? (
        <Sidebar
          razonSocial={company.nombreComercial || company.razonSocial}
          regimen={REGIMEN_LABEL[company.regimen] ?? ""}
        />
      ) : (
        <div className="hidden w-60 shrink-0 bg-slate-900 md:block" />
      )}
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </>
  );
}
