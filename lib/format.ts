import type { Cents, Recurring, TransactionType } from "@/lib/domain/types";

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const shortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

export const formatCents = (cents: Cents) => currency.format(cents / 100);

export const formatSigned = (cents: Cents, type: TransactionType) =>
  (type === "gasto" ? "−" : "+") + formatCents(cents);

/** `YYYY-MM-DD` → "3 may". */
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso + "T00:00:00Z"));

/** `YYYY-MM` → "Mayo de 2026". */
export function formatMonth(month: string): string {
  const s = monthName.format(new Date(month + "-01T00:00:00Z"));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const dayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
const monthOnly = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });

/** "Cada mes, día 4" · "Cada 3 meses (desde marzo), día 1" · "Cada año, 1 de marzo". */
export function describeSchedule(r: Pick<Recurring, "frequency" | "day" | "startDate">): string {
  const anchor = new Date(r.startDate.slice(0, 8) + "01T00:00:00Z");
  if (r.frequency === "mensual") return `Cada mes, día ${r.day}`;
  if (r.frequency === "trimestral") return `Cada 3 meses (desde ${monthOnly.format(anchor)}), día ${r.day}`;
  anchor.setUTCDate(Math.min(r.day, 28));
  const d = new Date(anchor);
  return `Cada año, ${r.day > 28 ? `${r.day} de ${monthOnly.format(d)}` : dayMonth.format(d)}`;
}
