import { diasEntre, fmtUSD } from "./format";
import type { Company, Expense, Invoice, Party, Project } from "./types";

export interface Recomendacion {
  nivel: "alerta" | "aviso" | "info" | "exito";
  titulo: string;
  detalle: string;
}

export function generarRecomendaciones(
  company: Company,
  invoices: Invoice[],
  expenses: Expense[],
  projects: Project[],
  parties: Party[]
): Recomendacion[] {
  const recs: Recomendacion[] = [];
  const hoy = new Date();

  // 1. Cartera vencida
  const vencidas = invoices.filter((f) => !f.pagada && new Date(f.fechaVencimiento) < hoy);
  const porVencer = invoices.filter((f) => {
    if (f.pagada) return false;
    const d = diasEntre(hoy, new Date(f.fechaVencimiento));
    return d >= 0 && d <= 7;
  });
  if (vencidas.length > 0) {
    const total = vencidas.reduce((s, f) => s + f.total, 0);
    recs.push({
      nivel: "alerta",
      titulo: `Cartera vencida: ${fmtUSD(total)} en ${vencidas.length} factura(s)`,
      detalle:
        "Emita recordatorios de cobro y evalúe acuerdos de pago. Una cartera vencida deteriora el flujo de caja y encarece el capital de trabajo.",
    });
  }
  if (porVencer.length > 0) {
    recs.push({
      nivel: "aviso",
      titulo: `${porVencer.length} factura(s) por vencer esta semana`,
      detalle:
        "Programe el seguimiento de cobro anticipado para evitar moras y mantener la liquidez.",
    });
  }

  // 2. Proyectos en riesgo (avance vs tiempo transcurrido)
  const enRiesgo = projects.filter((p) => {
    if (p.estado !== "EN_PROGRESO") return false;
    const inicio = new Date(p.fechaInicio).getTime();
    const fin = new Date(p.fechaFin).getTime();
    const t = hoy.getTime();
    if (fin <= t) return true;
    const esperado = ((t - inicio) / (fin - inicio)) * 100;
    return p.avance < esperado - 15;
  });
  if (enRiesgo.length > 0) {
    recs.push({
      nivel: "alerta",
      titulo: `${enRiesgo.length} proyecto(s) con avance por debajo del cronograma`,
      detalle: `Detectados: ${enRiesgo.map((p) => p.codigo).join(", ")}. Revise cuellos de botella, reasigne recursos o renegocie plazos con el cliente.`,
    });
  }
  const sinHitosVencidos = projects.filter(
    (p) =>
      (p.estado === "EN_PROGRESO" || p.estado === "PLANIFICACION") &&
      p.hitos.some((h) => !h.completado && new Date(h.fecha) < hoy)
  );
  if (sinHitosVencidos.length > 0) {
    recs.push({
      nivel: "aviso",
      titulo: "Hay hitos vencidos sin completar",
      detalle: `Actualice el estado de los hitos en ${sinHitosVencidos.map((p) => p.codigo).join(", ")} para reflejar la realidad operativa.`,
    });
  }

  // 3. Margen bruto
  const ingresosTotales = invoices.filter((f) => f.pagada).reduce((s, f) => s + f.total, 0);
  const gastosTotales = expenses.reduce((s, g) => s + g.total, 0);
  if (ingresosTotales > 0) {
    const margen = (ingresosTotales - gastosTotales) / ingresosTotales;
    if (margen < 0.2) {
      recs.push({
        nivel: "alerta",
        titulo: `Margen operativo bajo (${(margen * 100).toFixed(1)}%)`,
        detalle:
          "Analice los rubros de mayor costo (arriendos, servicios profesionales y publicidad concentran retenciones IR altas) y renegocie condiciones con proveedores.",
      });
    } else {
      recs.push({
        nivel: "exito",
        titulo: `Margen operativo saludable (${(margen * 100).toFixed(1)}%)`,
        detalle:
          "Mantenga el control de costos. Considere reinvertir utilidades: la reinversión calificada reduce la tarifa del IR hasta un 8–10%.",
      });
    }
  }

  // 4. Exportación Perú
  const hayExport = invoices.some((f) =>
    f.items.some((i) => i.tipoIva === "TARIFA_0" && parties.find((p) => p.id === f.clienteId)?.provincia.startsWith("Exterior"))
  );
  if (!hayExport || projects.some((p) => p.ciudad === "Lima")) {
    recs.push({
      nivel: "info",
      titulo: "Preparativos para exportar a Perú",
      detalle:
        "Sus ventas a clientes del exterior usan tarifa 0% de IVA (exportación de servicios). Para bienes: registre al exportador en SENAE, emita la DAI, factura comercial, packing list y certificado de origen CAN para preferencia arancelaria. Evalúe el drawback (3% del valor FOB).",
    });
  }

  // 5. Configuración tributaria incompleta
  if (company.ruc.length !== 13 || !/^\d{13}$/.test(company.ruc)) {
    recs.push({
      nivel: "aviso",
      titulo: "Complete los datos fiscales de la empresa",
      detalle:
        "El RUC configurado no parece válido. Vaya a Configuración e ingrese su RUC real: las fechas límite de declaración dependen del noveno dígito.",
    });
  }
  if (company.regimen === "GENERAL" && !company.contribuyenteEspecial) {
    recs.push({
      nivel: "info",
      titulo: "Evalúe solicitar calidad de contribuyente especial o revisar RIMPE",
      detalle:
        "Si sus ingresos superan USD 100.000/año debe pasar a Régimen General con contabilidad obligatoria. La calidad de contribuyente especial puede ser ventajosa si opera con grandes clientes que retienen IVA; también habilita declarar hasta el día 9 de cada mes.",
    });
  }

  // 6. Gastos deducibles sin comprobante
  const sinComprobante = expenses.filter((g) => !/^\d{3}-\d{3}-\d{9}$/.test(g.numeroComprobante));
  if (sinComprobante.length > 0) {
    recs.push({
      nivel: "aviso",
      titulo: "Gastos con número de comprobante irregular",
      detalle:
        "Solo son deducibles los gastos sustentados en comprobantes electrónicos válidos (factura — código 01). Verifique la serie completa XXX-XXX-XXXXXXXXX antes del cierre mensual del ATS.",
    });
  }

  return recs;
}
