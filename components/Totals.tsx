import type { Transaction } from "@/lib/domain/types";
import { Amount } from "./Amount";

export function sumTotals(transactions: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === "ingreso") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

export function Totals({ transactions }: { transactions: Transaction[] }) {
  const { income, expense, net } = sumTotals(transactions);
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      <div>
        <dt className="text-slate-500">Ingresos</dt>
        <dd><Amount cents={income} type="ingreso" /></dd>
      </div>
      <div>
        <dt className="text-slate-500">Gastos</dt>
        <dd><Amount cents={expense} type="gasto" /></dd>
      </div>
      <div>
        <dt className="text-slate-500">Neto</dt>
        <dd className="font-semibold"><Amount cents={net} /></dd>
      </div>
    </dl>
  );
}
