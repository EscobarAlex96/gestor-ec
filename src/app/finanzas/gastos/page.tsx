"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Field, inputCls, KpiCard,
  Modal, PageHeader, useHydrated,
} from "@/components/ui";
import { fmtFecha, fmtUSD, hoyISO } from "@/lib/format";
import { useGestor } from "@/lib/store";
import { retencionesIRSugeridas, retencionIVASugerida, TAX_CONFIG } from "@/lib/taxes";
import type { CategoriaGasto, Expense } from "@/lib/types";

const CATEGORIAS: { id: CategoriaGasto; label: string; tipoBase: "BIENES" | "SERVICIOS" }[] = [
  { id: "BIENES_MUEBLES", label: "Compra de bienes muebles", tipoBase: "BIENES" },
  { id: "SERVICIOS_MANO_OBRA", label: "Servicios (predomina mano de obra)", tipoBase: "SERVICIOS" },
  { id: "SERVICIOS_PROFESIONALES_PN", label: "Servicios profesionales — persona natural", tipoBase: "SERVICIOS" },
  { id: "SERVICIOS_PROFESIONALES_SOCIEDAD", label: "Servicios profesionales — sociedad", tipoBase: "SERVICIOS" },
  { id: "PUBLICIDAD", label: "Promoción y publicidad", tipoBase: "SERVICIOS" },
  { id: "ARRIENDO_INMUEBLE", label: "Arrendamiento de bienes inmuebles", tipoBase: "SERVICIOS" },
  { id: "ARRIENDO_MERCANTIL", label: "Arrendamiento mercantil", tipoBase: "SERVICIOS" },
  { id: "TRANSPORTE", label: "Transporte de pasajeros/carga", tipoBase: "SERVICIOS" },
  { id: "OTROS", label: "Otros pagos sujetos a retención", tipoBase: "SERVICIOS" },
];

export default function GastosPage() {
  const hidratado = useHydrated();
  const { expenses, parties, company, addExpense, removeExpense } = useGestor();
  const proveedores = parties.filter((p) => p.categoria === "PROVEEDOR");

  const [modal, setModal] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGasto>("BIENES_MUEBLES");
  const [base0, setBase0] = useState(0);
  const [base15, setBase15] = useState(0);
  const [fecha, setFecha] = useState(hoyISO());

  const ivaCalc = Math.round(base15 * TAX_CONFIG.IVA_GENERAL * 100) / 100;
  const totalCalc = Math.round((base0 + base15 + ivaCalc) * 100) / 100;

  const prevRetIR = useMemo(() => retencionesIRSugeridas(categoria, base15), [categoria, base15]);
  const prevPctIVA = useMemo(
    () => retencionIVASugerida(categoria, proveedores.find((p) => p.id === proveedorId), company.agenteRetencion),
    [categoria, proveedorId, proveedores, company.agenteRetencion]
  );

  const kpis = useMemo(() => {
    const hoy = new Date();
    const delMes = expenses.filter((g) => {
      const d = new Date(g.fecha);
      return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
    });
    return {
      gastoMes: delMes.reduce((s, g) => s + g.total, 0),
      ivaSoportado: delMes.reduce((s, g) => s + g.iva, 0),
      retIR: expenses.reduce((s, g) => s + g.retencionesIR.reduce((x, r) => x + r.valor, 0), 0),
      retIVA: expenses.reduce((s, g) => s + g.retencionesIVA.reduce((x, r) => x + r.valor, 0), 0),
    };
  }, [expenses]);

  if (!hidratado) {
    return <div className="animate-pulse rounded-xl bg-white/60 p-10 text-sm text-slate-400">Cargando gastos…</div>;
  }

  const guardar = () => {
    if (!proveedorId || !concepto.trim() || totalCalc <= 0) return;
    const gasto: Omit<Expense, "id" | "retencionesIR" | "retencionesIVA"> = {
      fecha, proveedorId, numeroComprobante: comprobante || "S/N",
      concepto, categoria, base0, base15, iva: ivaCalc, total: totalCalc,
    };
    addExpense(gasto as Parameters<typeof addExpense>[0]);
    setModal(false);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        titulo="Gastos y compras"
        subtitulo="Registro con retenciones en la fuente (Resolución NAC-DGERCGC26-00000009)"
        acciones={<Button onClick={() => setModal(true)}><Plus size={15} /> Registrar gasto</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard titulo="Gastos del mes" valor={fmtUSD(kpis.gastoMes)} tono="amber" />
        <KpiCard titulo="IVA soportado (mes)" valor={fmtUSD(kpis.ivaSoportado)} detalle="Crédito tributario contra IVA cobrado" />
        <KpiCard titulo="Retenciones IR practicadas" valor={fmtUSD(kpis.retIR)} tono="indigo" />
        <KpiCard titulo="Retenciones IVA practicadas" valor={fmtUSD(kpis.retIVA)} tono="emerald" />
      </div>

      <Card className="mt-4 overflow-x-auto">
        {expenses.length === 0 ? (
          <EmptyState mensaje="Aún no hay gastos registrados." />
        ) : (
          <table className="data w-full min-w-[980px]">
            <thead>
              <tr>
                <th>Fecha</th><th>Comprobante</th><th>Proveedor</th><th>Concepto</th><th>Categoría</th>
                <th className="text-right">Total</th><th className="text-right">Ret. IR</th>
                <th className="text-right">Ret. IVA</th><th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((g) => {
                const prov = parties.find((p) => p.id === g.proveedorId);
                const ir = g.retencionesIR.reduce((s, r) => s + r.valor, 0);
                const ivar = g.retencionesIVA.reduce((s, r) => s + r.valor, 0);
                return (
                  <tr key={g.id}>
                    <td>{fmtFecha(g.fecha)}</td>
                    <td className={`font-mono text-xs ${/^\d{3}-\d{3}-\d{9}$/.test(g.numeroComprobante) ? "" : "text-rose-500 font-semibold"}`}>{g.numeroComprobante}</td>
                    <td className="max-w-44 truncate">{prov?.razonSocial ?? "—"}</td>
                    <td className="max-w-52 truncate">{g.concepto}</td>
                    <td><Badge color="slate">{CATEGORIAS.find((c) => c.id === g.categoria)?.label.split("—")[0].trim()}</Badge></td>
                    <td className="text-right font-semibold">{fmtUSD(g.total)}</td>
                    <td className="text-right text-indigo-700">{ir > 0 ? fmtUSD(ir) : "—"}</td>
                    <td className="text-right text-emerald-700">{ivar > 0 ? fmtUSD(ivar) : "—"}</td>
                    <td className="text-right">
                      <button onClick={() => confirm("¿Eliminar este registro de gasto?") && removeExpense(g.id)} className="rounded px-1.5 py-1 text-rose-500 hover:bg-rose-50">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} titulo="Registrar gasto / compra">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Fecha"><input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
          <Field label="Proveedor *">
            <select className={inputCls} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Seleccione…</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
            </select>
          </Field>
          <Field label="N° comprobante (XXX-XXX-XXXXXXXXX)">
            <input className={inputCls} placeholder="001-001-000123456" value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Concepto *"><input className={inputCls} value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Honorarios contables mensuales" /></Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Categoría (define retención IR)">
              <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}>
                {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label} — {TAX_CONFIG.RETENCIONES_IR_2026[c.id].pct}% ({TAX_CONFIG.RETENCIONES_IR_2026[c.id].codigo})</option>)}
              </select>
            </Field>
          </div>
          <Field label="Base tarifa 0%"><input type="number" min={0} step="any" className={inputCls} value={base0} onChange={(e) => setBase0(Number(e.target.value))} /></Field>
          <Field label="Base gravada 15%"><input type="number" min={0} step="any" className={inputCls} value={base15} onChange={(e) => setBase15(Number(e.target.value))} /></Field>
          <Field label="IVA 15% (auto)">
            <input readOnly className={`${inputCls} bg-slate-100`} value={ivaCalc.toFixed(2)} />
          </Field>
        </div>

        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-sm">
          <p className="mb-1 font-semibold text-indigo-800">Retenciones sugeridas como agente de retención</p>
          {prevRetIR.map((r, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span>IR · {r.concepto} ({r.porcentaje}%):</span><strong>{fmtUSD(r.valor)}</strong>
            </div>
          ))}
          <div className="flex justify-between text-xs">
            <span>IVA retenido ({prevPctIVA}% sobre IVA):</span><strong>{fmtUSD((ivaCalc * prevPctIVA) / 100)}</strong>
          </div>
          <div className="mt-1 flex justify-between border-t border-indigo-200 pt-1">
            <span>Total a pagar al proveedor:</span><strong>{fmtUSD(totalCalc - prevRetIR[0]?.valor - (ivaCalc * prevPctIVA) / 100)}</strong>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!proveedorId || !concepto.trim()}>Guardar gasto</Button>
        </div>
      </Modal>
    </div>
  );
}
