"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Field, inputCls, KpiCard,
  Modal, PageHeader, ProgressBar, Tabs, useHydrated,
} from "@/components/ui";
import { fmtFecha, fmtUSD, hoyISO, uid } from "@/lib/format";
import { useGestor } from "@/lib/store";
import type { EstadoProyecto, Hito, Project } from "@/lib/types";

const ESTADOS: { id: EstadoProyecto; label: string; color: "sky" | "indigo" | "amber" | "emerald" | "slate" }[] = [
  { id: "PLANIFICACION", label: "Planificación", color: "sky" },
  { id: "EN_PROGRESO", label: "En progreso", color: "indigo" },
  { id: "PAUSADO", label: "Pausado", color: "amber" },
  { id: "COMPLETADO", label: "Completado", color: "emerald" },
  { id: "CANCELADO", label: "Cancelado", color: "slate" },
];

const proyectoVacio = (clienteId: string): Project => ({
  id: "", codigo: "", nombre: "", clienteId, ciudad: "Quito",
  fechaInicio: hoyISO(), fechaFin: hoyISO(), presupuesto: 0, costoEjecutado: 0,
  estado: "PLANIFICACION", avance: 0, prioridad: "MEDIA", responsable: "", hitos: [],
});

export default function ProyectosPage() {
  const hidratado = useHydrated();
  const { projects, parties, upsertProject, removeProject, toggleHito } = useGestor();
  const clientes = parties.filter((p) => p.categoria === "CLIENTE");

  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<Project>(proyectoVacio(clientes[0]?.id ?? ""));
  const [nuevoHito, setNuevoHito] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const filtrados = useMemo(
    () => (filtroEstado === "TODOS" ? projects : projects.filter((p) => p.estado === filtroEstado)),
    [projects, filtroEstado]
  );

  const kpis = useMemo(() => {
    const activos = projects.filter((p) => p.estado === "EN_PROGRESO" || p.estado === "PLANIFICACION");
    return {
      total: projects.length,
      activos: activos.length,
      presupuesto: activos.reduce((s, p) => s + p.presupuesto, 0),
      ejecutado: activos.reduce((s, p) => s + p.costoEjecutado, 0),
    };
  }, [projects]);

  if (!hidratado) {
    return <div className="animate-pulse rounded-xl bg-white/60 p-10 text-sm text-slate-400">Cargando proyectos…</div>;
  }

  const abrirNuevo = () => {
    const anio = new Date().getFullYear();
    const num = String(projects.filter((p) => p.codigo.includes(String(anio))).length + 1).padStart(2, "0");
    setForm({ ...proyectoVacio(clientes[0]?.id ?? ""), codigo: `PROY-${anio}-${num}` });
    setModalAbierto(true);
  };

  const guardar = () => {
    if (!form.nombre.trim() || !form.clienteId) return;
    upsertProject({ ...form, id: form.id || uid() });
    setModalAbierto(false);
  };

  const agregarHitoAlForm = () => {
    if (!nuevoHito.trim()) return;
    const hito: Hito = { id: uid(), titulo: nuevoHito.trim(), fecha: form.fechaFin, completado: false };
    setForm({ ...form, hitos: [...form.hitos, hito] });
    setNuevoHito("");
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        titulo="Seguimiento de proyectos"
        subtitulo="Control de avance, presupuestos e hitos por cliente y ciudad"
        acciones={<Button onClick={abrirNuevo}><Plus size={15} /> Nuevo proyecto</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard titulo="Proyectos totales" valor={String(kpis.total)} />
        <KpiCard titulo="Activos" valor={String(kpis.activos)} tono="indigo" />
        <KpiCard titulo="Presupuesto activo" valor={fmtUSD(kpis.presupuesto)} tono="emerald" />
        <KpiCard titulo="Costo ejecutado" valor={fmtUSD(kpis.ejecutado)} tono="amber"
          detalle={kpis.presupuesto > 0 ? `Consumo ${Math.round((kpis.ejecutado / kpis.presupuesto) * 100)}%` : undefined} />
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[{ id: "TODOS", label: `Todos (${projects.length})` }, ...ESTADOS.map((e) => ({ id: e.id, label: e.label }))]}
          activa={filtroEstado}
          onChange={setFiltroEstado}
        />
      </div>

      <div className="mt-4 space-y-3">
        {filtrados.length === 0 && <EmptyState mensaje="No hay proyectos en este estado." />}
        {filtrados.map((p) => {
          const cliente = clientes.find((c) => c.id === p.clienteId);
          const abierto = expandido === p.id;
          const consumoPresupuesto = p.presupuesto > 0 ? (p.costoEjecutado / p.presupuesto) * 100 : 0;
          return (
            <Card key={p.id} className="overflow-hidden">
              <button className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setExpandido(abierto ? null : p.id)}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-600">{p.codigo}</span>
                    <Badge color={ESTADOS.find((e) => e.id === p.estado)?.color}>{ESTADOS.find((e) => e.id === p.estado)?.label}</Badge>
                    {p.prioridad === "ALTA" && <Badge color="rose">Prioridad alta</Badge>}
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-800">{p.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {cliente?.nombreComercial ?? cliente?.razonSocial} · {p.ciudad} · {fmtFecha(p.fechaInicio)} → {fmtFecha(p.fechaFin)} · Resp.: {p.responsable}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-36">
                    <ProgressBar pct={p.avance} />
                    <p className="mt-1 text-right text-[11px] text-slate-500">Avance {p.avance}%</p>
                  </div>
                  {abierto ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                </div>
              </button>

              {abierto && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                    <span>Presupuesto: <strong>{fmtUSD(p.presupuesto)}</strong></span>
                    <span>Ejecutado: <strong>{fmtUSD(p.costoEjecutado)}</strong></span>
                    <span>Consumo: <strong>{consumoPresupuesto.toFixed(0)}%</strong></span>
                    <span>Hitos completados: <strong>{p.hitos.filter((h) => h.completado).length}/{p.hitos.length}</strong></span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {p.hitos.map((h) => (
                      <li key={h.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={h.completado}
                          onChange={() => toggleHito(p.id, h.id)}
                          className="h-3.5 w-3.5 accent-indigo-600"
                        />
                        <span className={`text-sm ${h.completado ? "text-slate-400 line-through" : "text-slate-700"}`}>{h.titulo}</span>
                        <span className={`ml-auto text-xs ${new Date(h.fecha) < new Date() && !h.completado ? "font-semibold text-rose-500" : "text-slate-400"}`}>
                          {fmtFecha(h.fecha)}
                        </span>
                      </li>
                    ))}
                    {p.hitos.length === 0 && <li className="px-1 text-xs text-slate-400">Sin hitos registrados.</li>}
                  </ul>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => { setForm(p); setModalAbierto(true); }}>Editar</Button>
                    <Button variant="danger" onClick={() => confirm(`¿Eliminar el proyecto ${p.codigo}?`) && removeProject(p.id)}>
                      <Trash2 size={14} /> Eliminar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} titulo={form.id ? "Editar proyecto" : "Nuevo proyecto"} ancho="max-w-3xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Código"><input className={inputCls} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></Field>
          <Field label="Nombre del proyecto *">
            <input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Implementación ERP" />
          </Field>
          <Field label="Cliente *">
            <select className={inputCls} value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
            </select>
          </Field>
          <Field label="Ciudad / sede">
            <input className={inputCls} value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
          </Field>
          <Field label="Responsable"><input className={inputCls} value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} /></Field>
          <Field label="Estado">
            <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoProyecto })}>
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </Field>
          <Field label="Fecha inicio"><input type="date" className={inputCls} value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} /></Field>
          <Field label="Fecha fin estimada"><input type="date" className={inputCls} value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} /></Field>
          <Field label="Presupuesto (USD)"><input type="number" min={0} className={inputCls} value={form.presupuesto} onChange={(e) => setForm({ ...form, presupuesto: Number(e.target.value) })} /></Field>
          <Field label="Costo ejecutado (USD)"><input type="number" min={0} className={inputCls} value={form.costoEjecutado} onChange={(e) => setForm({ ...form, costoEjecutado: Number(e.target.value) })} /></Field>
          <Field label={`Avance: ${form.avance}%`}>
            <input type="range" min={0} max={100} value={form.avance} onChange={(e) => setForm({ ...form, avance: Number(e.target.value) })} className="w-full accent-indigo-600" />
          </Field>
          <Field label="Prioridad">
            <select className={inputCls} value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value as Project["prioridad"] })}>
              <option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción"><textarea rows={2} className={inputCls} value={form.descripcion ?? ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Field>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Hitos</p>
          <div className="space-y-1.5">
            {form.hitos.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-slate-700">{h.titulo}</span>
                <input type="date" className={`${inputCls} w-auto`} value={h.fecha}
                  onChange={(e) => setForm({ ...form, hitos: form.hitos.map((x) => x.id === h.id ? { ...x, fecha: e.target.value } : x) })} />
                <Button variant="ghost" onClick={() => setForm({ ...form, hitos: form.hitos.filter((x) => x.id !== h.id) })}><Trash2 size={13} /></Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input className={inputCls} placeholder="Nuevo hito…" value={nuevoHito} onChange={(e) => setNuevoHito(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && agregarHitoAlForm()} />
            <Button variant="secondary" onClick={agregarHitoAlForm}>Agregar</Button>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalAbierto(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!form.nombre.trim()}>Guardar proyecto</Button>
        </div>
      </Modal>
    </div>
  );
}
