export type ID = string;

export interface Establecimiento {
  codigo: string;
  ciudad: string;
  direccion: string;
}

export interface Company {
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  regimen: "RIMPE_EMPRENDEDOR" | "RIMPE_RENTABLE" | "GENERAL";
  contribuyenteEspecial: boolean;
  numeroResolucionCE: string;
  agenteRetencion: boolean;
  obligadoContabilidad: boolean;
  exportadorHabitual: boolean;
  direccionMatriz: string;
  email: string;
  telefono: string;
  establecimientos: Establecimiento[];
}

export type TipoId = "RUC" | "CEDULA" | "PASAPORTE";

export interface Party {
  id: ID;
  categoria: "CLIENTE" | "PROVEEDOR";
  tipoId: TipoId;
  numId: string;
  razonSocial: string;
  nombreComercial?: string;
  ciudad: string;
  provincia: string;
  telefono?: string;
  email?: string;
  contribuyenteEspecial?: boolean;
  obligadoContabilidad?: boolean;
}

export type TipoIva = "GRAVADO_15" | "TARIFA_0" | "EXENTO";

export interface Product {
  id: ID;
  codigo: string;
  nombre: string;
  descripcion?: string;
  precioUnit: number;
  tipoIva: TipoIva;
  unidad: string;
  exportable: boolean;
}

export type EstadoProyecto =
  | "PLANIFICACION"
  | "EN_PROGRESO"
  | "PAUSADO"
  | "COMPLETADO"
  | "CANCELADO";

export interface Hito {
  id: ID;
  titulo: string;
  fecha: string;
  completado: boolean;
}

export interface Project {
  id: ID;
  codigo: string;
  nombre: string;
  descripcion?: string;
  clienteId: ID;
  ciudad: string;
  fechaInicio: string;
  fechaFin: string;
  presupuesto: number;
  costoEjecutado: number;
  estado: EstadoProyecto;
  avance: number;
  prioridad: "BAJA" | "MEDIA" | "ALTA";
  responsable: string;
  hitos: Hito[];
}

export interface InvoiceItem {
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  tipoIva: TipoIva;
}

export interface Invoice {
  id: ID;
  numero: string;
  clienteId: ID;
  proyectoId?: ID;
  fecha: string;
  fechaVencimiento: string;
  items: InvoiceItem[];
  subtotal0: number;
  subtotal15: number;
  exento: number;
  iva: number;
  total: number;
  pagada: boolean;
  fechaPago?: string;
  ambiente: "PRUEBAS" | "PRODUCCION";
}

export type CategoriaGasto =
  | "BIENES_MUEBLES"
  | "SERVICIOS_MANO_OBRA"
  | "SERVICIOS_PROFESIONALES_PN"
  | "SERVICIOS_PROFESIONALES_SOCIEDAD"
  | "PUBLICIDAD"
  | "ARRIENDO_INMUEBLE"
  | "ARRIENDO_MERCANTIL"
  | "TRANSPORTE"
  | "OTROS";

export interface Retencion {
  concepto: string;
  base: number;
  porcentaje: number;
  valor: number;
}

export interface Expense {
  id: ID;
  fecha: string;
  proveedorId: ID;
  numeroComprobante: string;
  concepto: string;
  categoria: CategoriaGasto;
  base0: number;
  base15: number;
  iva: number;
  total: number;
  retencionesIR: Retencion[];
  retencionesIVA: Retencion[];
}
