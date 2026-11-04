import type { Totals } from "@/lib/domain/investments";
import { formatCents } from "@/lib/format";
import { Gain } from "./Gain";

/** Value, gains and (when there is real estate debt) net worth. */
export function InvestmentTotals({ totals }: { totals: Totals }) {
  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "text-lg font-semibold" : ""}`}>{value}</dd>
    </div>
  );
  return (
    <dl className="text-sm">
      {row("Valor actual", formatCents(totals.value), true)}
      {row("Valor de compra", formatCents(totals.purchaseValue))}
      {row("Plusvalía", <Gain cents={totals.gain} base={totals.purchaseValue} />)}
      {row("Coste fiscal", formatCents(totals.fiscalCost))}
      {row("Plusvalía fiscal", <Gain cents={totals.fiscalGain} base={totals.fiscalCost} />)}
      {totals.debt > 0 && (
        <>
          {row("Deuda hipotecaria", `−${formatCents(totals.debt)}`)}
          {row("Patrimonio neto", formatCents(totals.net), true)}
        </>
      )}
      {totals.missing > 0 && (
        <p className="pt-1 text-xs text-amber-800">
          {totals.missing === 1 ? "1 activo sin valor" : `${totals.missing} activos sin valor`}: no cuentan en los totales.
        </p>
      )}
    </dl>
  );
}
