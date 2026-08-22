"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Tabs,
} from "@/components/ui";
import { useHydrated, PageHeader } from "@/components/ui";
import { fmtUSD } from "@/lib/format";
import { useGestor } from "@/lib/store";

const PARTY_TABS = [
  { id: "clientes", label: "Clientes" },
  { id: "proveedores", label: "Proveedores" },
  { id: "productos", label: "Productos" },
];

export default function RegistrosPage() {
  const hidratado = useHydrated();
  const { parties, products } = useGestor();
  const [tab, setTab] = useState("clientes");

  const currentParties = parties.filter((p) => p.categoria === (tab === "clientes" ? "CLIENTE" : "PROVEEDOR"));

  if (!hidratado) {
    return <div className="animate-pulse rounded-xl bg-white/60 p-10 text-sm text-slate-400">Cargando registros…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        titulo="Registros y catálogos"
        subtitulo="Administración de clientes, proveedores y productos/servicios"
      />

      <Tabs
          tabs={PARTY_TABS.map((t) => ({ id: t.id, label: t.label }))}
          activa={tab}
          onChange={setTab}
/>

      <div className="mt-4">
        {tab === "productos" ? (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Catálogo de productos</h2>
            {products.length === 0 ? (
              <EmptyState mensaje="No hay productos registrados." />
            ) : (
              <table className="data w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th>Código</th><th>Nombre</th><th className="text-right">Precio Unit.</th><th>IVA</th><th>Unidad</th><th className="text-right">Exportable</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.codigo}</td>
                      <td>{p.nombre}</td>
                      <td className="text-right">{fmtUSD(p.precioUnit)}</td>
                      <td><Badge color="indigo">Gravado 15%</Badge></td>
                      <td>{p.unidad}</td>
                      <td><Badge color="emerald">{p.exportable ? "Sí" : "No"}</Badge></td>
<td className="text-right">
                          <Button variant="danger" onClick={() => {/* remove */}}>Eliminar</Button>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ) : (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              {tab === "clientes" ? "Clientes" : "Proveedores"}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {currentParties.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-200 bg-white/80 p-3 text-xs text-slate-700">
                  <p className="font-medium truncate">{p.razonSocial}</p>
                  <p className="truncate">{p.nombreComercial || ""} · {p.ciudad}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{p.tipoId === "RUC" ? `RUC: ${p.numId}` : `Cédula: ${p.numId}`}</p>
                </div>
              ))}
            </div>
            {!currentParties.length && <EmptyState mensaje="No hay registros con este filtro." />}
          </Card>
        )}
      </div>
    </div>
  );
}