"use client";

import { useMemo } from "react";
import {
  AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardList,
  FileText, Info, Lightbulb, TrendingUp, Wallet,
} from "lucide-react";
import { BarrasIngresosGastos, PastelEstados } from "@/components/charts";
import { Badge, Card, KpiCard, PageHeader, ProgressBar, useHydrated } from "@/components/ui";
import { diasEntre, fmtUSD, MESES } from "@/lib/format";
import { generarRecomendaciones } from "@/lib/recommendations";
import { useGestor } from "@/lib/store";
import { diaLimiteMensual, fechaLimiteDeclaracion } from "@/lib/taxes";
import { novenoDigitoRuc } from "@/lib/validators";

const ESTADO_COLOR: Record<string, string> = {
  PLANIFICACION: "bg-sky-500",
  EN_PROGRESO: "bg-indigo-500",
  PAUSADO: "bg-amber-500",
  COMPLETADO: "bg-emerald-500",
  CANCELADO: "bg-slate-400",
};

export default function DashboardPage() {
  const hidratado = useHydrated();
  const { company, invoices, expenses, projects, parties } = useGestor();

  const datos = useMemo(() => {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anio = hoy.getFullYear();

    const delMes = <T extends { fecha: string }>(arr: T[]) =>
      arr.filter((x) => {
        const d = new Date(x.fecha);
        return d.getMonth() === mesActual && d.getFullYear() === anio;
      });

    const ingresosMes = delMes(invoices).reduce((s, f) => s + f.total, 0);
    const gastosMes = delMes(expenses).reduce((s, g) => s + g.total, 0);
    const cartera = invoices.filter((f) => !f.pagada && new Date(f.fechaVencimiento) >= hoy).reduce((s, f) => s + f.total, 0);
    const vencida = invoices.filter((f) => !f.pagada && new Date(f.fechaVencimiento) < hoy).reduce((s, f) => s + f.total, 0);

    // Serie últimos 6 meses
    const serie: { mes: string; ingresos: number; gastos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(anio, mesActual - i, 1);
      const mm = m.getMonth(), yy = m.getFullYear();
      const ing = invoices.filter((f) => { const d = new Date(f.fecha); return d.getMonth() === mm && d.getFullYear() === yy; }).reduce((s, f) => s + f.total, 0);
      const gas = expenses.filter((g) => { const d = new Date(g.fecha); return d.getMonth() === mm && d.getFullYear() === yy; }).reduce((s, g) => s + g.total, 0);
      serie.push({ mes: `${MESES[mm]}`, ingresos: Math.round(ing), gastos: Math.round(gas) });
    }

    const estadosProyectos = ["PLANIFICACION", "EN_PROGRESO", "PAUSADO", "COMPLETADO", "CANCELADO"]
      .map((e) => ({ name: e.replace("_", " "), value: projects.filter((p) => p.estado === e).length }))
      .filter((x) => x.value > 0);

    const noveno = novenoDigitoRuc(company.ruc);
    const limite = fechaLimiteDeclaracion(company.ruc, company.contribuyenteEspecial);
    const diasParaVencer = diasEntre(hoy, limite);

    const activos = projects.filter((p) => p.estado === "EN_PROGRESO" || p.estado === "PLANIFICACION");

    return {
      ingresosMes, gastosMes, cartera, vencida, serie, estadosProyectos,
      noveno, limite, diasParaVencer, activos,
      recomendaciones: generarRecomendaciones(company, invoices, expenses, projects, parties),
    };
  }, [company, invoices, expenses, projects, parties]);

  if (!hidratado) {
    return <div className="animate-pulse rounded-xl bg-white/60 p-10 text-sm text-slate-400">Cargando dashboard…</div>;
  }

  const nivelIcono = {
    alerta: <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" />,
    aviso: <Info size={16} className="mt-0.5 shrink-0 text-amber-500" />,
    info: <Lightbulb size={16} className="mt-0.5 shrink-0 text-indigo-500" />,
    exito: <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />,
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        titulo="Dashboard general"
        subtitulo={`Resumen operativo y tributario · ${new Date().toLocaleDateString("es-EC", { month: "long", year: "numeric" })}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard titulo="Ingresos del mes" valor={fmtUSD(datos.ingresosMes)} icono={<CircleDollarSign size={18} />} tono="indigo" />
        <KpiCard titulo="Gastos del mes" valor={fmtUSD(datos.gastosMes)} icono={<Wallet size={18} />} tono="amber" detalle={`Margen ${datos.ingresosMes > 0 ? (((datos.ingresosMes - datos.gastosMes) / datos.ingresosMes) * 100).toFixed(0) : "—"}%`} />
        <KpiCard titulo="Cartera por cobrar" valor={fmtUSD(datos.cartera)} icono={<FileText size={18} />} tono="emerald" />
        <KpiCard titulo="Cartera vencida" valor={fmtUSD(datos.vencida)} icono={<AlertTriangle size={18} />} tono={datos.vencida > 0 ? "rose" : "slate"} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Gráfico principal */}
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Ingresos vs. Gastos — últimos 6 meses</h2>
            <Badge color="indigo">USD</Badge>
          </div>
          <BarrasIngresosGastos data={datos.serie} />
        </Card>

        {/* Obligación SRI */}
        <div className="space-y-4">
          <Card className="border-l-4 border-l-rose-500 p-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-rose-500" />
              <h2 className="text-sm font-semibold text-slate-800">Próxima declaración mensual</h2>
            </div>
            <p className="mt-2 text-xs text-slate-500">F104 (IVA), F103 (retenciones IR) y ATS</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {datos.limite.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {company.contribuyenteEspecial
                ? "Contribuyente especial: hasta el día 9."
                : `Según noveno dígito del RUC (${datos.noveno ?? "?"}): hasta el ${diaLimiteMensual(datos.noveno)}.`}
            </p>
            <p className="mt-2 text-sm font-semibold text-rose-600">
              {datos.diasParaVencer >= 0 ? `Faltan ${datos.diasParaVencer} día(s)` : `¡Venció hace ${Math.abs(datos.diasParaVencer)} día(s)!`}
            </p>
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">Estado de proyectos</h2>
            </div>
            <PastelEstados data={datos.estadosProyectos} />
          </Card>
        </div>
      </div>

      {/* Recomendaciones */}
      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-800">Recomendaciones inteligentes</h2>
          <span className="ml-auto text-xs text-slate-400">{datos.recomendaciones.length} hallazgo(s)</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {datos.recomendaciones.map((r, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-2">
                {nivelIcono[r.nivel]}
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{r.detalle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Proyectos destacados */}
      <Card className="mt-4 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Proyectos activos</h2>
        {datos.activos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No hay proyectos activos.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {datos.activos.map((p) => {
              const cliente = parties.find((c) => c.id === p.clienteId);
              return (
                <div key={p.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-indigo-600">{p.codigo}</p>
                      <p className="text-sm font-medium text-slate-800">{p.nombre}</p>
                      <p className="text-xs text-slate-500">{cliente?.nombreComercial ?? cliente?.razonSocial} · {p.ciudad}</p>
                    </div>
                    <Badge color={p.estado === "EN_PROGRESO" ? "indigo" : "sky"}>{p.estado.replace("_", " ")}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <ProgressBar pct={p.avance} color={ESTADO_COLOR[p.estado]} />
                    <span className="w-10 text-right text-xs font-semibold text-slate-600">{p.avance}%</span>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>Presupuesto: <strong>{fmtUSD(p.presupuesto)}</strong></span>
                    <span>Ejecutado: <strong>{fmtUSD(p.costoEjecutado)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
