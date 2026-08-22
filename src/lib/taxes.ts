import type { CategoriaGasto, InvoiceItem, Party, Retencion, TipoIva } from "./types";

export const TAX_CONFIG = {
  anio: 2026,
  // Circular SRI NAC-DGECCGC25-00000006 (26-dic-2025): IVA general se mantiene en 15%
  IVA_GENERAL: 0.15,
  // Art. 37 LRTI: tarifa general IR sociedades
  IR_SOCIEDADES: 0.25,
  IR_RIMPE_EMPRENDEDOR_ESCALA: [
    { hasta: 5000, tarifa: 0.01 },
    { hasta: 10000, tarifa: 0.02 },
    { hasta: 15000, tarifa: 0.03 },
    { hasta: 20000, tarifa: 0.04 },
    { hasta: Infinity, tarifa: 0.05 },
  ],
  // Resolución NAC-DGERCGC26-00000009 (vigente desde 01-mar-2026)
  RETENCIONES_IR_2026: {
    BIENES_MUEBLES: { codigo: "301", pct: 2, label: "Compra de bienes muebles" },
    SERVICIOS_MANO_OBRA: { codigo: "307", pct: 3, label: "Servicios predominio mano de obra" },
    SERVICIOS_PROFESIONALES_PN: { codigo: "303", pct: 10, label: "Servicios profesionales persona natural" },
    SERVICIOS_PROFESIONALES_SOCIEDAD: { codigo: "305", pct: 5, label: "Servicios profesionales sociedad" },
    PUBLICIDAD: { codigo: "332", pct: 3, label: "Promoción y publicidad" },
    ARRIENDO_INMUEBLE: { codigo: "322", pct: 10, label: "Arrendamiento de bienes inmuebles" },
    ARRIENDO_MERCANTIL: { codigo: "320", pct: 1.75, label: "Arrendamiento mercantil" },
    TRANSPORTE: { codigo: "327", pct: 1, label: "Transporte privado pasajeros/carga" },
    OTROS: { codigo: "344", pct: 3, label: "Otros pagos sin porcentaje específico" },
  } as Record<CategoriaGasto, { codigo: string; pct: number; label: string }>,
};

export const TIPOS_IVA: { value: TipoIva; label: string }[] = [
  { value: "GRAVADO_15", label: "Gravado IVA 15%" },
  { value: "TARIFA_0", label: "Tarifa 0% (Art. 55 LRTI / exportaciones)" },
  { value: "EXENTO", label: "Exento / No objeto" },
];

export function calcularItems(items: InvoiceItem[]) {
  let subtotal15 = 0;
  let subtotal0 = 0;
  let exento = 0;
  for (const it of items) {
    const base = it.cantidad * it.precioUnit;
    if (it.tipoIva === "GRAVADO_15") subtotal15 += base;
    else if (it.tipoIva === "TARIFA_0") subtotal0 += base;
    else exento += base;
  }
  const iva = round2(subtotal15 * TAX_CONFIG.IVA_GENERAL);
  const total = round2(subtotal15 + subtotal0 + exento + iva);
  return {
    subtotal0: round2(subtotal0),
    subtotal15: round2(subtotal15),
    exento: round2(exento),
    iva,
    total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Retenciones de IVA que debemos practicar como agentes de retención.
 * Matriz simplificada vigente:
 * - Comprador agente de retención + proveedor Persona Natural NO obligada a llevar
 *   contabilidad: bienes 30%, servicios 70%, servicios con predominancia intelecto 100%.
 * - Proveedor contribuyente especial u obligado a contabilidad: 0%.
 */
export function retencionIVASugerida(
  categoria: CategoriaGasto,
  proveedor: Party | undefined,
  empresaAgente: boolean
): number {
  if (!empresaAgente || !proveedor) return 0;
  const esPNNoContabilidad =
    (proveedor.tipoId === "CEDULA" ||
      (proveedor.tipoId === "RUC" && validarTercerDigitoNatural(proveedor.numId))) &&
    !proveedor.obligadoContabilidad &&
    !proveedor.contribuyenteEspecial;
  if (!esPNNoContabilidad) return 0;
  if (
    categoria === "SERVICIOS_PROFESIONALES_PN" ||
    categoria === "ARRIENDO_INMUEBLE"
  )
    return 100;
  if (categoria === "BIENES_MUEBLES") return 30;
  return 70;
}

function validarTercerDigitoNatural(ruc: string): boolean {
  const d = Number((ruc || "")[2]);
  return !Number.isNaN(d) && d < 6;
}

export function retencionesIRSugeridas(
  categoria: CategoriaGasto,
  baseIR: number
): Retencion[] {
  const def = TAX_CONFIG.RETENCIONES_IR_2026[categoria];
  const valor = round2(baseIR * (def.pct / 100));
  return [{ concepto: def.label, base: round2(baseIR), porcentaje: def.pct, valor }];
}

/** Día límite mensual según noveno dígito del RUC (declaraciones F104/F103/ATS). */
export function diaLimiteMensual(novenoDigito: number | null): string {
  if (novenoDigito === null) return "—";
  const mapa: Record<number, string> = {
    1: "día 10", 2: "día 11", 3: "día 12", 4: "día 13", 5: "día 14",
    6: "día 15", 7: "día 16", 8: "día 17", 9: "día 18", 0: "día 19",
  };
  return mapa[novenoDigito] ?? "—";
}

export function fechaLimiteDeclaracion(
  ruc: string,
  contribuyenteEspecial: boolean,
  mesSiguienteAlPeriodo: Date = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
): Date {
  const noveno = Number((ruc || "").trim()[8] ?? NaN);
  const dia = contribuyenteEspecial ? 9 : isNaN(noveno) ? 19 : noveno === 0 ? 19 : 9 + noveno;
  return new Date(mesSiguienteAlPeriodo.getFullYear(), mesSiguienteAlPeriodo.getMonth(), dia);
}

/**
 * Fracción básica desgravada (referencial 2025: USD 12.430). Se indexa cada
 * año por IPC — verificar valor vigente publicado por el SRI.
 */
export const FBD_REFERENCIAL = 12430;

/** Escala Art. 52 LRTI expresada en múltiplos de la fracción básica desgravada. */
const ESCALA_PN: Record<"OBLIGADA" | "NO_OBLIGADA", { multHasta: number; tarifa: number }[]> = {
  OBLIGADA: [
    { multHasta: 2, tarifa: 0.15 }, { multHasta: 3, tarifa: 0.20 }, { multHasta: 4, tarifa: 0.25 },
    { multHasta: 6, tarifa: 0.30 }, { multHasta: 8, tarifa: 0.35 }, { multHasta: 10, tarifa: 0.37 },
    { multHasta: Infinity, tarifa: 0.40 },
  ],
  NO_OBLIGADA: [
    { multHasta: 2, tarifa: 0.05 }, { multHasta: 3, tarifa: 0.15 }, { multHasta: 4, tarifa: 0.20 },
    { multHasta: 6, tarifa: 0.25 }, { multHasta: 8, tarifa: 0.30 }, { multHasta: 10, tarifa: 0.35 },
    { multHasta: Infinity, tarifa: 0.37 },
  ],
};

function aplicarEscala(base: number, escala: { desde: number; hasta: number; tarifa: number }[]): number {
  let restante = base;
  let impuesto = 0;
  let anterior = 0;
  for (const t of escala) {
    if (restante <= 0) break;
    const b = Math.min(restante, t.hasta - anterior);
    impuesto += b * t.tarifa;
    restante -= b;
    anterior = t.hasta;
  }
  return round2(Math.max(0, impuesto));
}

/** Estimación referencial del IR anual según régimen tributario. */
export function estimarIR(
  ingresosGravables: number,
  regimen: string,
  obligadoContabilidad = true
): { tarifa: number; impuesto: number } {
  const base = Math.max(0, ingresosGravables);
  if (regimen === "RIMPE_EMPRENDEDOR") {
    const escala = TAX_CONFIG.IR_RIMPE_EMPRENDEDOR_ESCALA.map((t, i) => ({
      desde: i === 0 ? 0 : TAX_CONFIG.IR_RIMPE_EMPRENDEDOR_ESCALA[i - 1].hasta,
      hasta: t.hasta,
      tarifa: t.tarifa,
    }));
    const impuesto = aplicarEscala(base, escala);
    return { tarifa: base > 0 ? impuesto / base : 0, impuesto };
  }
  if (regimen === "RIMPE_RENTABLE") {
    // Tratamiento equivalente a persona natural no obligada a llevar contabilidad
    const escala = ESCALA_PN.NO_OBLIGADA.map((t, i) => ({
      desde: i === 0 ? 0 : FBD_REFERENCIAL * ESCALA_PN.NO_OBLIGADA[i - 1].multHasta,
      hasta: FBD_REFERENCIAL * t.multHasta,
      tarifa: t.tarifa,
    }));
    const impuesto = aplicarEscala(base - FBD_REFERENCIAL, escala);
    return { tarifa: base > 0 ? impuesto / base : 0, impuesto };
  }
  const impuesto = round2(base * TAX_CONFIG.IR_SOCIEDADES);
  return { tarifa: TAX_CONFIG.IR_SOCIEDADES, impuesto };
}
