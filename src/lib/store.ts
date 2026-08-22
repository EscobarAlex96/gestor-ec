"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uid } from "./format";
import { calcularItems, retencionesIRSugeridas, retencionIVASugerida } from "./taxes";
import type {
  Company, Expense, Hito, Invoice, InvoiceItem, Party, Product, Project,
} from "./types";

function rucJuridico(base9: string): string {
  const coef = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = base9.split("").map(Number);
  for (let t = 0; t < 10; t++) {
    let sum = 0;
    digits.forEach((d, i) => (sum += coef[i] * d));
    const res = sum % 11;
    const v = res === 0 ? 0 : 11 - res;
    if (v !== 10) return `${digits.join("")}${v}001`;
    digits[8] -= 1;
  }
  return `${base9}0001`;
}

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const defaultCompany: Company = {
  razonSocial: "MI EMPRESA CÍA. LTDA.",
  nombreComercial: "Mi Empresa",
  ruc: rucJuridico("179123456"),
  regimen: "GENERAL",
  contribuyenteEspecial: false,
  numeroResolucionCE: "",
  agenteRetencion: true,
  obligadoContabilidad: true,
  exportadorHabitual: false,
  direccionMatriz: "Av. Principal N24-56 y Colón",
  email: "facturacion@miempresa.com.ec",
  telefono: "+593 2 000 0000",
  establecimientos: [
    { codigo: "001", ciudad: "Quito", direccion: "Av. Amazonas N34-120" },
    { codigo: "002", ciudad: "Ambato", direccion: "Av. Los Chasquis y Cevallos" },
  ],
};

const clientesSeed = (): Party[] =>
  [
    ["Corporación Andina Textil S.A.", "Anditex", "Quito", "Pichincha", "RUC", true, true],
    ["Distribuidora Tungurahua Import Cía. Ltda.", "DTI Ambato", "Ambato", "Tungurahua", "RUC", false, true],
    ["Servicios Logísticos Sierra Norte S.A.S.", "LogiSierra", "Quito", "Pichincha", "RUC", false, true],
    ["Ferretería El Progreso de José Pérez", "Ferretería El Progreso", "Ambato", "Tungurahua", "CEDULA", false, false],
    ["Constructora Chimborazo Ríos Cía. Ltda.", "Construchimbo", "Guayaquil", "Guayas", "RUC", false, true],
    ["Peru Imports E.I.R.L. (cliente exterior)", "Peru Imports", "Lima", "Exterior - Perú", "PASAPORTE", false, false],
    ["Cafetería Aroma del Valle", "Aroma del Valle", "Ambato", "Tungurahua", "CEDULA", false, false],
    ["Instituto Público de Formación Técnica", "IPFT Quito", "Quito", "Pichincha", "RUC", true, true],
  ].map(([razonSocial, nombreComercial, ciudad, provincia, tipoId, ce, cont], i) => ({
    id: `cli-${i + 1}`,
    categoria: "CLIENTE" as const,
    tipoId: tipoId as Party["tipoId"],
    numId:
      tipoId === "RUC"
        ? i % 2 === 0
          ? rucJuridico("179234560")
          : rucJuridico(i === 7 ? "176123459" : "189234560")
        : tipoId === "CEDULA"
          ? `17123456${70 + i}`
          : `PE-${100200 + i}`,
    razonSocial: razonSocial as string,
    nombreComercial: nombreComercial as string,
    ciudad: ciudad as string,
    provincia: provincia as string,
    telefono: `+593 ${i < 4 ? "2" : "3"} 900 00${10 + i}`,
    email: `contacto${i + 1}@cliente${i + 1}.com`,
    contribuyenteEspecial: ce as boolean,
    obligadoContabilidad: cont as boolean,
  }));

const proveedoresSeed = (): Party[] =>
  [
    ["Almacenes Comerciales del Centro Cía. Ltda.", true, true, "BIENES_MUEBLES"],
    ["Estudio Contable & Asociados (persona natural)", false, false, "SERVICIOS_PROFESIONALES_PN"],
    ["Consultora Empresarial Andina S.A.", true, true, "SERVICIOS_PROFESIONALES_SOCIEDAD"],
    ["Arriendos Villacís (persona natural)", false, false, "ARRIENDO_INMUEBLE"],
    ["Publicidad Creativa del Ecuador Cía. Ltda.", false, true, "PUBLICIDAD"],
    ["Transportes Ruta Andina Cía. Ltda.", false, true, "TRANSPORTE"],
  ].map(([razonSocial, ce, cont], i) => ({
    id: `prov-${i + 1}`,
    categoria: "PROVEEDOR" as const,
    tipoId: (i === 1 || i === 3 ? "CEDULA" : "RUC") as Party["tipoId"],
    numId:
      i === 1 || i === 3
        ? `17045678${90 + i}`
        : rucJuridico(`17934567${i}`),
    razonSocial: razonSocial as string,
    ciudad: i < 3 ? "Quito" : "Ambato",
    provincia: i < 3 ? "Pichincha" : "Tungurahua",
    telefono: `+593 2 800 00${20 + i}`,
    email: `ventas${i + 1}@proveedor${i + 1}.com`,
    contribuyenteEspecial: ce as boolean,
    obligadoContabilidad: cont as boolean,
  }));

const productosSeed = (): Product[] => [
  { id: "prod-1", codigo: "SRV-01", nombre: "Consultoría gerencial", descripcion: "Consultoría por hora/proyecto", precioUnit: 85, tipoIva: "GRAVADO_15", unidad: "hora", exportable: true },
  { id: "prod-2", codigo: "SRV-02", nombre: "Mantenimiento industrial", precioUnit: 1250, tipoIva: "GRAVADO_15", unidad: "servicio", exportable: false },
  { id: "prod-3", codigo: "SRV-03", nombre: "Capacitación empresarial", precioUnit: 450, tipoIva: "GRAVADO_15", unidad: "jornada", exportable: true },
  { id: "prod-4", codigo: "BIEN-01", nombre: "Equipo de cómputo", precioUnit: 780, tipoIva: "GRAVADO_15", unidad: "unidad", exportable: true },
  { id: "prod-5", codigo: "BIEN-02", nombre: "Medicamentos e insumos médicos", descripcion: "Tarifa 0% Art. 55 LRTI", precioUnit: 32.5, tipoIva: "TARIFA_0", unidad: "caja", exportable: false },
  { id: "prod-6", codigo: "EXP-01", nombre: "Servicio exportación (venta al exterior)", descripcion: "Exportación de servicios: tarifa 0%", precioUnit: 1500, tipoIva: "TARIFA_0", unidad: "proyecto", exportable: true },
];

const proyectosSeed = (): Project[] => [
  {
    id: "pry-1", codigo: "PROY-2026-01", nombre: "Implementación ERP matriz Quito",
    clienteId: "cli-1", ciudad: "Quito", fechaInicio: isoOffset(-120), fechaFin: isoOffset(60),
    presupuesto: 48000, costoEjecutado: 31000, estado: "EN_PROGRESO", avance: 65,
    prioridad: "ALTA", responsable: "Dirección Administrativa",
    hitos: [
      { id: uid(), titulo: "Diagnóstico y levantamiento", fecha: isoOffset(-90), completado: true },
      { id: uid(), titulo: "Configuración módulos", fecha: isoOffset(-30), completado: true },
      { id: uid(), titulo: "Migración de datos", fecha: isoOffset(20), completado: false },
      { id: uid(), titulo: "Capacitación y cierre", fecha: isoOffset(55), completado: false },
    ],
  },
  {
    id: "pry-2", codigo: "PROY-2026-02", nombre: "Ampliación bodega Ambato",
    clienteId: "cli-2", ciudad: "Ambato", fechaInicio: isoOffset(-80), fechaFin: isoOffset(40),
    presupuesto: 72000, costoEjecutado: 55000, estado: "EN_PROGRESO", avance: 78,
    prioridad: "MEDIA", responsable: "Ing. Operaciones",
    hitos: [
      { id: uid(), titulo: "Diseño estructural", fecha: isoOffset(-60), completado: true },
      { id: uid(), titulo: "Obra civil", fecha: isoOffset(-10), completado: true },
      { id: uid(), titulo: "Instalaciones eléctricas", fecha: isoOffset(25), completado: false },
    ],
  },
  {
    id: "pry-3", codigo: "PROY-2026-03", nombre: "Estudio de mercado Perú (exportación)",
    clienteId: "cli-6", ciudad: "Lima", fechaInicio: isoOffset(-45), fechaFin: isoOffset(75),
    presupuesto: 18000, costoEjecutado: 4200, estado: "EN_PROGRESO", avance: 30,
    prioridad: "ALTA", responsable: "Gerencia Comercial",
    hitos: [
      { id: uid(), titulo: "Registro exportador SENAE", fecha: isoOffset(-20), completado: true },
      { id: uid(), titulo: "Certificado origen CAN", fecha: isoOffset(30), completado: false },
      { id: uid(), titulo: "Primera factura de exportación", fecha: isoOffset(70), completado: false },
    ],
  },
  {
    id: "pry-4", codigo: "PROY-2025-11", nombre: "Renovación flota logística",
    clienteId: "cli-3", ciudad: "Quito", fechaInicio: isoOffset(-200), fechaFin: isoOffset(-20),
    presupuesto: 95000, costoEjecutado: 93500, estado: "COMPLETADO", avance: 100,
    prioridad: "MEDIA", responsable: "Dirección Financiera",
    hitos: [{ id: uid(), titulo: "Entrega final", fecha: isoOffset(-25), completado: true }],
  },
  {
    id: "pry-5", codigo: "PROY-2026-04", nombre: "Digitalización archivo documental",
    clienteId: "cli-8", ciudad: "Quito", fechaInicio: isoOffset(-25), fechaFin: isoOffset(90),
    presupuesto: 22000, costoEjecutado: 3000, estado: "PLANIFICACION", avance: 8,
    prioridad: "BAJA", responsable: "Analista Admin.",
    hitos: [{ id: uid(), titulo: "Kick-off", fecha: isoOffset(5), completado: false }],
  },
  {
    id: "pry-6", codigo: "PROY-2025-09", nombre: "Mantenimiento preventivo planta",
    clienteId: "cli-5", ciudad: "Guayaquil", fechaInicio: isoOffset(-150), fechaFin: isoOffset(-60),
    presupuesto: 36000, costoEjecutado: 21000, estado: "PAUSADO", avance: 55,
    prioridad: "MEDIA", responsable: "Jefe Mantenimiento",
    hitos: [{ id: uid(), titulo: "Fase 1 equipos críticos", fecha: isoOffset(-100), completado: true }],
  },
];

function invoiceItemsSeed(productIdx: number[], cantidades: number[]): InvoiceItem[] {
  const prods = productosSeed();
  return productIdx.map((pi, k) => ({
    descripcion: prods[pi].nombre,
    cantidad: cantidades[k] ?? 1,
    precioUnit: prods[pi].precioUnit,
    tipoIva: prods[pi].tipoIva,
  }));
}

function buildInvoice(
  n: number, clienteId: string, proyectoId: string | undefined,
  dias: number, items: InvoiceItem[], pagada: boolean, venceEn = 30
): Invoice {
  const t = calcularItems(items);
  const now = new Date();
  now.setDate(now.getDate() + dias);
  const venc = new Date(now);
  venc.setDate(venc.getDate() + venceEn);
  const serie = dias % 2 === 0 ? "001" : "002";
  return {
    id: `fac-${n}`, numero: `${serie}-001-${String(n).padStart(9, "0")}`,
    clienteId, proyectoId, fecha: now.toISOString().slice(0, 10),
    fechaVencimiento: venc.toISOString().slice(0, 10),
    items, ...t, pagada, ambiente: "PRODUCCION",
  };
}

const facturasSeed = (): Invoice[] => {
  const f: Invoice[] = [];
  let n = 1;
  const patrones: [string, string | undefined, number, number[], number[], boolean][] = [
    ["cli-1", "pry-1", -230, [0, 2], [40, 1], true],
    ["cli-2", "pry-2", -215, [1], [3], true],
    ["cli-3", undefined, -195, [0], [60], true],
    ["cli-5", "pry-6", -180, [1, 4], [2, 10], true],
    ["cli-1", "pry-1", -160, [0], [50], true],
    ["cli-8", undefined, -145, [2], [4], true],
    ["cli-2", "pry-2", -130, [1], [4], true],
    ["cli-4", undefined, -115, [4], [8], true],
    ["cli-6", "pry-3", -100, [5], [2], true],
    ["cli-1", "pry-1", -85, [0, 2], [30, 2], true],
    ["cli-5", "pry-6", -75, [1], [3], true],
    ["cli-3", undefined, -60, [3], [6], true],
    ["cli-8", undefined, -48, [2], [3], true],
    ["cli-2", "pry-2", -38, [1], [2], true],
    ["cli-6", "pry-3", -30, [5], [3], true],
    ["cli-1", "pry-1", -22, [0], [45], false],
    ["cli-4", undefined, -18, [4], [12], true],
    ["cli-7", undefined, -14, [0], [8], true],
    ["cli-5", "pry-6", -10, [1], [2], false],
    ["cli-8", "pry-5", -7, [2], [5], true],
    ["cli-3", undefined, -5, [3], [4], false],
    ["cli-2", "pry-2", -3, [0, 1], [20, 1], false],
    ["cli-6", "pry-3", -2, [5], [1], false],
    ["cli-1", "pry-1", -1, [0], [25], false],
  ];
  for (const [cli, pry, dias, pis, cants, pagada] of patrones) {
    f.push(buildInvoice(n++, cli, pry, dias, invoiceItemsSeed(pis, cants), pagada));
  }
  // una factura vencida sin pagar para disparar alerta de cartera
  const vieja = buildInvoice(n++, "cli-7", undefined, -55, invoiceItemsSeed([0], [10]), false, 15);
  f.push(vieja);
  return f;
};

const gastosSeed = (): Expense[] => {
  const provs = proveedoresSeed();
  const defs: [number, string, Expense["categoria"], number, number][] = [
    [0, "Compra repuestos y herramientas", "BIENES_MUEBLES", -210, 2400],
    [1, "Honorarios contables mensuales", "SERVICIOS_PROFESIONALES_PN", -205, 600],
    [3, "Arriendo oficina Ambato", "ARRIENDO_INMUEBLE", -198, 1500],
    [2, "Consultoría procesos", "SERVICIOS_PROFESIONALES_SOCIEDAD", -175, 3200],
    [4, "Campaña publicitaria digital", "PUBLICIDAD", -150, 1800],
    [5, "Flete interprovincial", "TRANSPORTE", -140, 850],
    [0, "Compra equipos de cómputo", "BIENES_MUEBLES", -120, 5200],
    [1, "Honorarios contables mensuales", "SERVICIOS_PROFESIONALES_PN", -110, 600],
    [3, "Arriendo oficina Quito", "ARRIENDO_INMUEBLE", -95, 1800],
    [2, "Asesoría tributaria anual", "SERVICIOS_PROFESIONALES_SOCIEDAD", -80, 2800],
    [0, "Insumos de mantenimiento", "BIENES_MUEBLES", -65, 1900],
    [4, "Publicidad feria Ambato", "PUBLICIDAD", -50, 1200],
    [5, "Transporte carga Quito-Guayaquil", "TRANSPORTE", -42, 950],
    [1, "Honorarios contables mensuales", "SERVICIOS_PROFESIONALES_PN", -35, 600],
    [0, "Compra mobiliario oficinas", "BIENES_MUEBLES", -28, 3400],
    [2, "Auditoría interna", "SERVICIOS_PROFESIONALES_SOCIEDAD", -20, 4500],
    [3, "Arriendo bodega Ambato", "ARRIENDO_INMUEBLE", -14, 1300],
    [5, "Flete exportación muestra Lima", "TRANSPORTE", -8, 1100],
    [0, "Repuestos maquinaria", "BIENES_MUEBLES", -5, 2700],
  ];
  return defs.map(([pi, concepto, categoria, dias, monto], i) => {
    const base15 = Math.round(monto / 1.15 * 100) / 100;
    const iva = Math.round((monto - base15) * 100) / 100;
    const proveedor = provs[pi];
    return {
      id: `gas-${i + 1}`,
      fecha: isoOffset(dias),
      proveedorId: proveedor.id,
      numeroComprobante: `00${(i % 3) + 1}-001-${String(50000 + i * 137).slice(0, 9)}`,
      concepto,
      categoria,
      base0: 0,
      base15,
      iva,
      total: Math.round(monto * 100) / 100,
      retencionesIR: retencionesIRSugeridas(categoria, base15),
      retencionesIVA: (() => {
        const pct = retencionIVASugerida(categoria, proveedor, true);
        return pct > 0
          ? [{ concepto: `Retención IVA ${pct}%`, base: iva, porcentaje: pct, valor: Math.round(iva * pct) / 100 }]
          : [];
      })(),
    };
  });
};

interface GestorState {
  company: Company;
  parties: Party[];
  products: Product[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  checklist: Record<string, boolean>;
  updateCompany: (patch: Partial<Company>) => void;
  upsertParty: (p: Party) => void;
  removeParty: (id: string) => void;
  upsertProduct: (p: Product) => void;
  removeProduct: (id: string) => void;
  upsertProject: (p: Project) => void;
  removeProject: (id: string) => void;
  toggleHito: (projectId: string, hitoId: string) => void;
  addInvoice: (inv: Omit<Invoice, "id" | "subtotal0" | "subtotal15" | "iva" | "total"> & { items: InvoiceItem[] }) => void;
  togglePagada: (id: string) => void;
  removeInvoice: (id: string) => void;
  addExpense: (e: Omit<Expense, "id" | "retencionesIR" | "retencionesIVA">) => void;
  removeExpense: (id: string) => void;
  setChecklist: (key: string, value: boolean) => void;
  resetDemo: () => void;
}

export const useGestor = create<GestorState>()(
  persist(
    (set, get) => ({
      company: defaultCompany,
      parties: [...clientesSeed(), ...proveedoresSeed()],
      products: productosSeed(),
      projects: proyectosSeed(),
      invoices: facturasSeed(),
      expenses: gastosSeed(),
      checklist: {},
      updateCompany: (patch) => set((s) => ({ company: { ...s.company, ...patch } })),
      upsertParty: (p) => set((s) => ({
        parties: s.parties.some((x) => x.id === p.id)
          ? s.parties.map((x) => (x.id === p.id ? p : x))
          : [...s.parties, p],
      })),
      removeParty: (id) => set((s) => ({ parties: s.parties.filter((x) => x.id !== id) })),
      upsertProduct: (p) => set((s) => ({
        products: s.products.some((x) => x.id === p.id)
          ? s.products.map((x) => (x.id === p.id ? p : x))
          : [...s.products, p],
      })),
      removeProduct: (id) => set((s) => ({ products: s.products.filter((x) => x.id !== id) })),
      upsertProject: (p) => set((s) => ({
        projects: s.projects.some((x) => x.id === p.id)
          ? s.projects.map((x) => (x.id === p.id ? p : x))
          : [...s.projects, p],
      })),
      removeProject: (id) => set((s) => ({ projects: s.projects.filter((x) => x.id !== id) })),
      toggleHito: (projectId, hitoId) => set((s) => ({
        projects: s.projects.map((p) =>
          p.id !== projectId
            ? p
            : {
                ...p,
                hitos: p.hitos.map((h: Hito) => (h.id === hitoId ? { ...h, completado: !h.completado } : h)),
              }
        ),
      })),
      addInvoice: (inv) => set((s) => {
        const t = calcularItems(inv.items);
        return { invoices: [{ ...inv, ...t, id: uid() }, ...s.invoices] };
      }),
      togglePagada: (id) => set((s) => ({
        invoices: s.invoices.map((f) =>
          f.id === id ? { ...f, pagada: !f.pagada, fechaPago: !f.pagada ? new Date().toISOString().slice(0, 10) : undefined } : f
        ),
      })),
      removeInvoice: (id) => set((s) => ({ invoices: s.invoices.filter((f) => f.id !== id) })),
      addExpense: (e) => set((s) => {
        const proveedor = s.parties.find((p) => p.id === e.proveedorId);
        const retIR = retencionesIRSugeridas(e.categoria, e.base15);
        const pctIVA = retencionIVASugerida(e.categoria, proveedor, s.company.agenteRetencion);
        const retIVA =
          pctIVA > 0 && e.iva > 0
            ? [{ concepto: `Retención IVA ${pctIVA}%`, base: e.iva, porcentaje: pctIVA, valor: Math.round(e.iva * pctIVA) / 100 }]
            : [];
        return { expenses: [{ ...e, id: uid(), retencionesIR: retIR, retencionesIVA: retIVA }, ...s.expenses] };
      }),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      setChecklist: (key, value) => set((s) => ({ checklist: { ...s.checklist, [key]: value } })),
      resetDemo: () => set({
        company: defaultCompany,
        parties: [...clientesSeed(), ...proveedoresSeed()],
        products: productosSeed(),
        projects: proyectosSeed(),
        invoices: facturasSeed(),
        expenses: gastosSeed(),
        checklist: {},
      }),
    }),
    {
      name: "gestor-ec-v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export function partyNombre(parties: Party[], id: string): string {
  return parties.find((p) => p.id === id)?.razonSocial ?? "—";
}
