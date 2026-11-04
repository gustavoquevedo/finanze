import type { Cents, TransactionType } from "@/lib/domain/types";
import { formatCents, formatSigned } from "@/lib/format";

export function Amount({ cents, type }: { cents: Cents; type?: TransactionType }) {
  if (!type) {
    return <span className={`tabular-nums ${cents < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatCents(cents)}</span>;
  }
  return (
    <span className={`tabular-nums ${type === "gasto" ? "text-rose-700" : "text-emerald-700"}`}>
      {formatSigned(cents, type)}
    </span>
  );
}
