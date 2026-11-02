import type { Cents, TransactionType } from "@/lib/domain/types";

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
