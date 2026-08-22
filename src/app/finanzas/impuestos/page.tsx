"use client";

import { useMemo } from "react";
import { CalendarClock, Landmark, Percent, ReceiptText } from "lucide-react";
import { Badge, Card, KpiCard, PageHeader, useHydrated } from "@/components/ui";
import { fmtUSD, MESES } from "@/lib/format";
import { useGestor } from "@/lib/store";
import {
  diaLimiteMensual, estimarIR, fechaLimiteDeclaracion,
  FBD_REFERENCIAL, TAX_CONFIG,
} from "@/lib/taxes";
import { novenoDigitoRuc } from "@/lib/validators";

export default function ImpuestosPage() {
  const hidratado = useHydrated();
  const { company, invoices, expenses } = useGestor();

  const datos = useMemo(() => {
    const hoy = new Date();
    const anio = hoy.getFullYear();

    type FilaMes = {
      mesIdx: number; ventas0: number; ventas15: number; ivaCobrado: number;
      compras15: number; ivaPagado: number; retIR: number;
    };
    const filas: FilaMes[] = [];
    for (let m = 0; m <= hoy.getMonth(); m++) {
      filas.push({
        mesIdx: m,
        ventas0: 0, ventas15: 0, ivaCobrado: 0, compras15: 0, ivaPagado: 0, retIR: 0,
      });
    }
    for (const f of invoices) {
      const d = new Date(f.fecha);
      if (d.getFullYear() !== anio || d.getMonth() >= filas.length) continue;
      const fila = filas[d.getMonth()];
      fila.ventas0 += f.subtotal0;
      fila.ventas15 += f.subtotal15;
      fila.ivaCobrado += f.iva;
    }
    for (const g of expenses) {
      const d = new Date(g.fecha);
      if (d.getFullYear() !== anio || d.getMonth() >= filas.length) continue;
      const fila = filas[d.getMonth()];
      fila.compras15 += g.base0 + g.base15;
      fila.ivaPagado += g.iva;
      fila.retIR += g.retencionesIR.reduce((s, r) => s + r.valor, 0);
    }

    // Período que se declara este mes = mes anterior
    const idxPeriodo = Math.max(0, hoy.getMonth() - 1);
    const periodo = filas[idxPeriodo];
    const ivaLiquidoPeriodo = periodo.ivaCobrado - periodo.ivaPagado;

    const limiteMensual = fechaLimiteDeclaracion(company.ruc, company.contribuyenteEspecial);
    const diasRestantes = Math.ceil((limiteMensual.getTime() - hoy.getTime()) / 86400000);

    // Estimación IR año en curso
    const enAnio = <T extends { fecha: string }>(x: T) => new Date(x.fecha).getFullYear() === anio;
    const ingresosNetosIva = invoices.filter(enAnio).reduce((s, f) => s + f.subtotal0 + f.subtotal15 + f.exento, 0);
    const gastosDeducibles = expenses.filter(enAnio).reduce((s, g) => s + g.base0 + g.base15, 0);
    const utilidadGravable = Math.max(0, ingresosNetosIva - gastosDeducibles);
    const ir = estimarIR(utilidadGravable, company.regimen, company.obligadoContabilidad);

    const noveno = novenoDigitoRuc(company.ruc);

    return {
      filas, periodo, ivaLiquidoPeriodo, limiteMensual, diasRestantes,
      ingresosNetosIva, gastosDeducibles, utilidadGravable, ir, noveno,
      anioActual: anio,
    };
  }, [company, invoices, expenses]);

  if (!hidratado) {
    return <div className="animate-pulse rounded-xl bg-white/60 p-10 text-sm text-slate-400">Cargando impuestos…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        titulo={`Impuestos SRI — ejercicio fiscal ${datos.anioActual}`}
        subtitulo={`Régimen ${company.regimen.replace("_", " ")} · RUC ${company.ruc}`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          titulo="IVA líquido a declarar"
          valor={fmtUSD(datos.ivaLiquidoPeriodo)}
          tono={datos.ivaLiquidoPeriodo >= 0 ? "rose" : "emerald"}
          detalle={datos.ivaLiquidoPeriodo >= 0 ? `Período ${MESES[datos.periodo.mesIdx]} (por pagar)` : "Crédito tributario arrastrable"}
        />
        <KpiCard
          titulo="Retenciones IR practicadas"
          valor={fmtUSD(datos.filas.reduce((s, f) => s + f.retIR, 0))}
          detalle="Acumulado del ejercicio — va en F103 mensual"
        />
        <KpiCard
          titulo="Próximo vencimiento mensual"
          valor={datos.diasRestantes >= 0 ? `${datos.diasRestantes} días` : "VENCIDO"}
          tono={datos.diasRestantes > 5 ? "slate" : "rose"}
          detalle={datos.limiteMensual.toLocaleDateString("es-EC", { day: "numeric", month: "long" })}
          icono={<CalendarClock size={18} />}
        />
        <KpiCard
          titulo="IR estimado (ejercicio)"
          valor={fmtUSD(datos.ir.impuesto)}
          tono="indigo"
          detalle={`Tarifa efectiva ${(datos.ir.tarifa * 100).toFixed(1)}%`}
          icono={<Landmark size={18} />}
        />
      </div>

      {/* Resumen mensual */}
      <Card className="mt-4 overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Resumen tributario mensual (base para F104 / F103 / ATS)</h2>
          <Badge color="indigo">USD sin IVA salvo indicación</Badge>
        </div>
        <table className="data w-full min-w-[900px]">
          <thead>
            <tr>
              <th>Mes</th><th className="text-right">Ventas tarifa 0%</th><th className="text-right">Ventas gravadas 15%</th>
              <th className="text-right">IVA cobrado</th><th className="text-right">Compras deducibles</th>
              <th className="text-right">IVA pagado</th><th className="text-right">IVA líquido</th>
              <th className="text-right">Ret. IR practicada</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {datos.filas.map((f, i) => {
              const liquido = f.ivaCobrado - f.ivaPagado;
              const esPeriodoActual = i === datos.periodo.mesIdx && i < new Date().getMonth();
              return (
                <tr key={i}>
                  <td className="font-medium">{MESES[f.mesIdx]}</td>
                  <td className="text-right">{fmtUSD(f.ventas0)}</td>
                  <td className="text-right">{fmtUSD(f.ventas15)}</td>
                  <td className="text-right">{fmtUSD(f.ivaCobrado)}</td>
                  <td className="text-right">{fmtUSD(f.compras15)}</td>
                  <td className="text-right">{fmtUSD(f.ivaPagado)}</td>
                  <td className={`text-right font-semibold ${liquido < 0 ? "text-emerald-600" : "text-slate-800"}`}>{fmtUSD(liquido)}</td>
                  <td className="text-right text-indigo-700">{f.retIR > 0 ? fmtUSD(f.retIR) : "—"}</td>
                  <td>
                    {esPeriodoActual
                      ? <Badge color="amber">A declarar este mes</Badge>
                      : i === new Date().getMonth()
                        ? <Badge color="sky">En curso</Badge>
                        : liquido !== 0 || f.retIR !== 0 ? <Badge color="emerald">Registrado</Badge> : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Estimación IR */}
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Percent size={16} className="text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-800">Estimación referencial del Impuesto a la Renta {datos.anioActual}</h2>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Ingresos netos de IVA:</dt><dd>{fmtUSD(datos.ingresosNetosIva)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">(−) Gastos deducibles con comprobante:</dt><dd>{fmtUSD(datos.gastosDeducibles)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5"><dt className="font-medium">Utilidad gravable estimada:</dt><dd className="font-bold">{fmtUSD(datos.utilidadGravable)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">
              Tarifa aplicada ({company.regimen === "GENERAL" ? `sociedades ${TAX_CONFIG.IR_SOCIEDADES * 100}%` :
                company.regimen === "RIMPE_EMPRENDEDOR" ? "escala progresiva 1%–5%" : `escala Art. 52 · FBD ${fmtUSD(FBD_REFERENCIAL)}`}):
            </dt><dd>{(datos.ir.tarifa * 100).toFixed(1)}%</dd></div>
            <div className="flex justify-between border-t border-slate-300 pt-1.5 text-base"><dt className="font-semibold text-indigo-700">IR causado estimado:</dt><dd className="font-bold text-indigo-700">{fmtUSD(datos.ir.impuesto)}</dd></div>
          </dl>
          <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800">
            Estimación referencial sobre flujo registrado en la app (no incluye depreciaciones, ajustes NIIF, anticipos,
            dividendos ni reducciones por reinversión). La liquidación definitiva se realiza en el Formulario 101 con su contador.
          </p>
        </Card>

        {/* Calendario */}
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock size={16} className="text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-800">Calendario tributario</h2>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-sm">
            <p className="font-semibold text-indigo-800">Declaraciones mensuales (F104 · F103 · ATS)</p>
            <p className="text-xs leading-relaxed text-slate-600">
              Noveno dígito del RUC: <strong>{datos.noveno ?? "?"}</strong> → vence hasta el{" "}
              <strong>{diaLimiteMensual(datos.noveno)}</strong> del mes siguiente.
              {company.contribuyenteEspecial ? " Como contribuyente especial: hasta el día 9." : ""}
            </p>
            <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
                <span key={d} className={`rounded px-1 py-0.5 ${d === datos.noveno ? "bg-indigo-600 font-bold text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
                  d{d}: {9 + d}
                </span>
              ))}
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-600">
            <li>• <strong>Formulario 101 (IR sociedades):</strong> abril según noveno dígito del RUC.</li>
            <li>• <strong>Anexo de Relaciones y Participaciones:</strong> junto con la declaración anual de IR.</li>
            <li>• <strong>Nómina y aportes IESS:</strong> hasta el último día hábil de cada mes (patronal 12,15%).</li>
            <li>• <strong>Décimo tercero:</strong> pago hasta el 24 de diciembre. <strong>Décimo cuarto:</strong> hasta el 15 de agosto (o acumulado).</li>
            <li>• <strong>Comprobantes de retención electrónicos:</strong> emitir dentro del plazo legal tras el pago/acreditación.</li>
          </ul>
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
            <ReceiptText size={14} className="mt-0.5 shrink-0" />
            Interés por mora ≈ tasa activa BCE (mensual). Multas por incumplimiento de deberes formales entre USD 17 y valores proporcionales al impuesto (Art. 21 LRTI).
          </p>
        </Card>
      </div>
    </div>
  );
}
