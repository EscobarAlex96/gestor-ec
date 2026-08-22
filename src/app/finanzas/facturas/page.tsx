"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Field, inputCls, KpiCard,
  Modal, PageHeader, Tabs, useHydrated,
} from "@/components/ui";
import { fmtFecha, fmtUSD, hoyISO, uid } from "@/lib/format";
import { useGestor } from "@/lib/store";
import { calcularItems, TAX_CONFIG, TIPOS_IVA } from "@/lib/taxes";
import type { InvoiceItem } from "@/lib/types";

const itemVacio: InvoiceItem = { descripcion: "", cantidad: 1, precioUnit: 0, tipoIva: "GRAVADO_15" };

export default function FacturasPage() {
  const hidratado = useHydrated();
  const { invoices, parties, projects, products, addInvoice, togglePagada, removeInvoice } = useGestor();
  const clientes = parties.filter((p) => p.categoria === "CLIENTE");

  const [tab, setTab] = useState("TODAS");
  const [modal, setModal] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([{ ...itemVacio }]);
  const [clienteId, setClienteId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [venceEn, setVenceEn] = useState(30);

  const totalesPreview = useMemo(() => calcularItems(items), [items]);

  const filtradas = useMemo(() => {
    const hoy = new Date();
    return invoices.filter((f) => {
      if (tab === "PAGADAS") return f.pagada;
      if (tab === "PENDIENTES") return !f.pagada && new Date(f.fechaVencimiento) >= hoy;
      if (tab === "VENCIDAS") return !f.pagada && new Date(f.fechaVencimiento) < hoy;
      return true;
    });
  }, [invoices, tab]);

  const kpis = useMemo(() => {
    const hoy = new Date();
    const mesActual = hoy.getMonth(), anio = hoy.getFullYear();
    const delMes = invoices.filter((f) => {
      const d = new Date(f.fecha);
      return d.getMonth() === mesActual && d.getFullYear() === anio;
    });
    return {
      facturadoMes: delMes.reduce((s, f) => s + f.total, 0),
      cobrado: invoices.filter((f) => f.pagada).reduce((s, f) => s + f.total, 0),
      porCobrar: invoices.filter((f) => !f.pagada && new Date(f.fechaVencimiento) >= hoy).reduce((s, f) => s + f.total, 0),
      vencidas: invoices.filter((f) => !f.pagada && new Date(f.fechaVencimiento) < hoy).length,
      ivaMes: delMes.reduce((s, f) => s + f.iva, 0),
    };
  }, [invoices]);

  if (!hidratado) {
    return <div className="animate-pulse rounded-xl bg-white/60 p-10 text-sm text-slate-400">Cargando facturas…</div>;
  }

  const abrirNueva = () => {
    setClienteId(clientes[0]?.id ?? "");
    setProyectoId("");
    setFecha(hoyISO());
    setVenceEn(30);
    setItems([{ ...itemVacio }]);
    setModal(true);
  };

  const agregarProductoCatalogo = (pid: string) => {
    const prod = products.find((p) => p.id === pid);
    if (!prod) return;
    setItems((its) => [...its, { descripcion: prod.nombre, cantidad: 1, precioUnit: prod.precioUnit, tipoIva: prod.tipoIva }]);
  };

  const guardar = () => {
    if (!clienteId || items.length === 0 || totalesPreview.total <= 0) return;
    const maxNum = invoices.reduce((mx, f) => Math.max(mx, Number(f.numero.split("-")[2]) || 0), 0);
    addInvoice({
      numero: `001-001-${String(maxNum + 1).padStart(9, "0")}`,
      clienteId,
      proyectoId: proyectoId || undefined,
      fecha,
      fechaVencimiento: (() => {
        const d = new Date(fecha);
        d.setDate(d.getDate() + venceEn);
        return d.toISOString().slice(0, 10);
      })(),
      items: items.filter((i) => i.descripcion.trim() && i.cantidad > 0),
      exento: 0,
      pagada: false,
      ambiente: "PRODUCCION",
    });
    setModal(false);
  };

  const estadoFactura = (f: (typeof invoices)[number]) =>
    f.pagada
      ? <Badge color="emerald">Pagada</Badge>
      : new Date(f.fechaVencimiento) < new Date()
        ? <Badge color="rose">Vencida</Badge>
        : <Badge color="amber">Pendiente</Badge>;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        titulo="Facturación electrónica"
        subtitulo={`Comprobantes de venta · IVA general ${TAX_CONFIG.IVA_GENERAL * 100}% vigente ${TAX_CONFIG.anio}`}
        acciones={<Button onClick={abrirNueva}><Plus size={15} /> Nueva factura</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard titulo="Facturado este mes" valor={fmtUSD(kpis.facturadoMes)} tono="indigo" />
        <KpiCard titulo="Cobrado (histórico)" valor={fmtUSD(kpis.cobrado)} tono="emerald" />
        <KpiCard titulo="Por cobrar" valor={fmtUSD(kpis.porCobrar)} tono="amber" />
        <KpiCard titulo={`IVA generado del mes`} valor={fmtUSD(kpis.ivaMes)} detalle={`${kpis.vencidas} factura(s) vencida(s)`} />
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { id: "TODAS", label: `Todas (${invoices.length})` },
            { id: "PENDIENTES", label: "Pendientes" },
            { id: "VENCIDAS", label: "Vencidas" },
            { id: "PAGADAS", label: "Pagadas" },
          ]}
          activa={tab}
          onChange={setTab}
        />
      </div>

      <Card className="mt-4 overflow-x-auto">
        {filtradas.length === 0 ? (
          <EmptyState mensaje="No hay facturas en este filtro." />
        ) : (
          <table className="data w-full min-w-[860px]">
            <thead>
              <tr>
                <th>N° Comprobante</th><th>Fecha</th><th>Cliente</th>
                <th className="text-right">Base 0%</th><th className="text-right">Base 15%</th>
                <th className="text-right">IVA</th><th className="text-right">Total</th>
                <th>Vence</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => {
                const cli = parties.find((c) => c.id === f.clienteId);
                return (
                  <tr key={f.id}>
                    <td className="font-mono text-xs">{f.numero}</td>
                    <td>{fmtFecha(f.fecha)}</td>
                    <td className="max-w-48 truncate">{cli?.razonSocial ?? "—"}</td>
                    <td className="text-right">{fmtUSD(f.subtotal0)}</td>
                    <td className="text-right">{fmtUSD(f.subtotal15)}</td>
                    <td className="text-right">{fmtUSD(f.iva)}</td>
                    <td className="text-right font-semibold">{fmtUSD(f.total)}</td>
                    <td>{fmtFecha(f.fechaVencimiento)}</td>
                    <td>{estadoFactura(f)}</td>
                    <td className="whitespace-nowrap text-right">
                      <button onClick={() => togglePagada(f.id)} className="mr-2 rounded px-1.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                        {f.pagada ? "Marcar pendiente" : "Marcar pagada"}
                      </button>
                      <button onClick={() => confirm(`¿Anular factura ${f.numero}?`) && removeInvoice(f.id)} className="rounded px-1.5 py-1 text-rose-500 hover:bg-rose-50">
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

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Nota SRI: los comprobantes electrónicos deben transmitirse al SRI y ponerse a disposición del cliente en el plazo legal.
        Desde 2026 rige la transmisión inmediata de comprobantes electrónicos (Resolución NAC-DGERCGC25-00000017).
        Las exportaciones de bienes y servicios se facturan con tarifa 0% de IVA.
      </p>

      {/* Modal nueva factura */}
      <Modal open={modal} onClose={() => setModal(false)} titulo="Nueva factura electrónica" ancho="max-w-4xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Cliente *">
            <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Seleccione…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
            </select>
          </Field>
          <Field label="Proyecto (opcional)">
            <select className={inputCls} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
            </select>
          </Field>
          <Field label="Fecha emisión"><input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
          <Field label="Plazo crédito (días)"><input type="number" min={0} className={inputCls} value={venceEn} onChange={(e) => setVenceEn(Number(e.target.value))} /></Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ítems</span>
          <select className={`${inputCls} w-auto`} defaultValue="" onChange={(e) => { agregarProductoCatalogo(e.target.value); e.currentTarget.value = ""; }}>
            <option value="">+ Agregar del catálogo…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
          </select>
          <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setItems([...items, { ...itemVacio }])}>+ Línea manual</button>
        </div>

        <div className="mt-2 space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 p-2">
              <input className={`${inputCls} col-span-5`} placeholder="Descripción *" value={it.descripcion}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, descripcion: e.target.value } : x))} />
              <input type="number" min={0.01} step="any" className={`${inputCls} col-span-2`} placeholder="Cant." value={it.cantidad}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, cantidad: Number(e.target.value) } : x))} />
              <input type="number" min={0} step="any" className={`${inputCls} col-span-2`} placeholder="P. unitario" value={it.precioUnit}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, precioUnit: Number(e.target.value) } : x))} />
              <select className={`${inputCls} col-span-2`} value={it.tipoIva}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, tipoIva: e.target.value as InvoiceItem["tipoIva"] } : x))}>
                {TIPOS_IVA.map((t) => <option key={t.value} value={t.value}>{t.label.split(" (")[0]}</option>)}
              </select>
              <button className="col-span-1 flex items-center justify-center rounded text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal 15%:</span><strong>{fmtUSD(totalesPreview.subtotal15)}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Subtotal 0%:</span><strong>{fmtUSD(totalesPreview.subtotal0)}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Exento:</span><strong>{fmtUSD(totalesPreview.exento)}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">IVA 15%:</span><strong>{fmtUSD(totalesPreview.iva)}</strong></div>
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base"><span>Total:</span><strong className="text-indigo-700">{fmtUSD(totalesPreview.total)}</strong></div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!clienteId || items.every((i) => !i.descripcion.trim())}>Emitir factura</Button>
        </div>
      </Modal>
    </div>
  );
}
