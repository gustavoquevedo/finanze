import type { Totals as TotalsValue } from "@/lib/domain/totals";
import { Amount } from "./Amount";

/** Income, expenses and net; plus cash flow when there is mortgage principal. */
export function Totals({ totals }: { totals: TotalsValue }) {
  const { income, expense, net, principal, cashFlow } = totals;
  return (
    <div>
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
      {principal > 0 && (
        <p className="mt-2 flex justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <span>Capital hipoteca <Amount cents={principal} type="gasto" /></span>
          <span>
            Flujo de caja <span className="font-medium"><Amount cents={cashFlow} /></span>
          </span>
        </p>
      )}
    </div>
  );
}
