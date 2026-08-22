export const fmtUSD = (n: number): string =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);

export const fmtPct = (n: number): string => `${(n * 100).toFixed(1)}%`;

export const fmtFecha = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
};

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const hoyISO = (): string => new Date().toISOString().slice(0, 10);

export function diasEntre(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
