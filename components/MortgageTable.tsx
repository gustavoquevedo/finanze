"use client";

import Link from "next/link";
import type { DatedInstallment } from "@/lib/domain/mortgage";
import { formatCents } from "@/lib/format";

const money = (c: number) => formatCents(c).replace(/\s?€/, "");
const COLS = "grid grid-cols-[1.5rem_3.4rem_repeat(4,minmax(3.4rem,1fr))] gap-x-1 px-2";

/** Amortization table rows. Past rows are greyed out and adjusted ones highlighted. */
export function MortgageRows({ rows, today }: { rows: DatedInstallment[]; today: string }) {
  return (
    // The table scrolls sideways inside its card on narrow screens; the page itself does not.
    <div className="overflow-x-auto rounded-xl bg-white text-[11px] shadow-sm">
      <div className="min-w-[20rem]">
        <div className={`${COLS} border-b border-slate-100 py-2 text-slate-500`}>
          <span>Nº</span>
          <span>Fecha</span>
          <span className="text-right">Cuota</span>
          <span className="text-right">Intereses</span>
          <span className="text-right">Capital</span>
          <span className="text-right">Pendiente</span>
        </div>
        {rows.map((q) => (
          <div
            key={q.number}
            className={`${COLS} border-b border-slate-50 py-1.5 tabular-nums last:border-0 ${q.date <= today ? "text-slate-400" : ""} ${q.adjusted ? "bg-sky-50" : ""}`}
          >
            <span>{q.number}</span>
            <span>{q.date.slice(8, 10)}/{q.date.slice(5, 7)}/{q.date.slice(2, 4)}</span>
            <span className="text-right">{money(q.payment)}</span>
            <span className="text-right">{money(q.interest)}</span>
            <span className="text-right">{money(q.principal)}</span>
            <span className="text-right">{money(q.balance)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Next 12 installments, with a link to the full table. */
export function MortgageTable({ plan, today, fullHref }: { plan: DatedInstallment[]; today: string; fullHref: string }) {
  const firstPending = Math.max(0, plan.findIndex((q) => q.date > today));
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Próximas cuotas</h2>
        <Link href={fullHref} className="text-sm font-medium text-emerald-700">Cuadro completo ›</Link>
      </div>
      <MortgageRows rows={plan.slice(Math.max(0, firstPending - 1), firstPending + 12)} today={today} />
      <p className="text-xs text-slate-500">Importes en €. En gris, cuotas ya pagadas; en azul, recalculadas por un ajuste.</p>
    </section>
  );
}
