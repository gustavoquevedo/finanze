"use client";

import { useState } from "react";
import type { DatedInstallment } from "@/lib/domain/mortgage";
import { formatCents } from "@/lib/format";

/** Amortization table: next 12 installments, or all of them. Past rows are greyed out. */
export function MortgageTable({ plan, today }: { plan: DatedInstallment[]; today: string }) {
  const [all, setAll] = useState(false);
  const firstPending = Math.max(0, plan.findIndex((q) => q.date > today));
  const rows = all ? plan : plan.slice(Math.max(0, firstPending - 1), firstPending + 12);
  const money = (c: number) => formatCents(c).replace(/\s?€/, "");

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">Cuadro de amortización</h2>
      <div className="rounded-xl bg-white text-xs shadow-sm">
        <div className="grid grid-cols-[2.5rem_4.5rem_repeat(3,minmax(0,1fr))] gap-x-2 border-b border-slate-100 px-3 py-2 text-slate-500">
          <span>Nº</span>
          <span>Fecha</span>
          <span className="text-right">Intereses</span>
          <span className="text-right">Capital</span>
          <span className="text-right">Pendiente</span>
        </div>
        {rows.map((q) => (
          <div
            key={q.number}
            className={`grid grid-cols-[2.5rem_4.5rem_repeat(3,minmax(0,1fr))] gap-x-2 border-b border-slate-50 px-3 py-1.5 tabular-nums last:border-0 ${q.date <= today ? "text-slate-400" : ""} ${q.adjusted ? "bg-sky-50" : ""}`}
          >
            <span>{q.number}</span>
            <span>{q.date.slice(8, 10)}/{q.date.slice(5, 7)}/{q.date.slice(2, 4)}</span>
            <span className="text-right">{money(q.interest)}</span>
            <span className="text-right">{money(q.principal)}</span>
            <span className="text-right">{money(q.balance)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Importes en €. En azul, cuotas recalculadas por un ajuste.</p>
      <button type="button" onClick={() => setAll((v) => !v)} className="text-sm font-medium text-emerald-700">
        {all ? "Ver solo las próximas" : `Ver las ${plan.length} cuotas`}
      </button>
    </section>
  );
}
