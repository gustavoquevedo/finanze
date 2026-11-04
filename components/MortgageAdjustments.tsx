"use client";

import { useState } from "react";
import { todayIso } from "@/lib/domain/dates";
import { parseEuros } from "@/lib/domain/money";
import type { MortgageAdjustment } from "@/lib/domain/types";
import { formatCents, formatShortDate } from "@/lib/format";
import { inputClass, labelClass } from "./form-styles";
import { FieldError } from "./TransactionForm";

/** List and add "real outstanding principal at a date" adjustments. */
export function MortgageAdjustments({
  adjustments,
  onChange,
}: {
  adjustments: MortgageAdjustment[];
  onChange: (next: MortgageAdjustment[]) => Promise<void>;
}) {
  const [date, setDate] = useState(todayIso());
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const sorted = [...adjustments].sort((a, b) => a.date.localeCompare(b.date));

  async function save(next: MortgageAdjustment[]) {
    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseEuros(balance);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Indica la fecha.");
    if (cents === null && balance.trim() !== "0") return setError("Importe no válido. Ejemplo: 89.512,34");
    await save([...adjustments.filter((a) => a.date !== date), { date, balance: cents ?? 0 }]);
    setBalance("");
    setError(undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Ajustes de capital pendiente</h2>
      <p className="text-sm text-slate-600">
        Si el banco indica un capital pendiente distinto, añádelo con su fecha: la cuota se recalcula para el plazo que queda y
        las próximas cuotas salen corregidas. Las ya creadas no cambian.
      </p>
      {sorted.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
          {sorted.map((a) => (
            <li key={a.date} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span>{formatShortDate(a.date)} {a.date.slice(0, 4)}</span>
              <span className="tabular-nums font-medium">{formatCents(a.balance)}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => window.confirm("¿Quitar este ajuste?") && void save(adjustments.filter((x) => x.date !== a.date))}
                className="text-rose-700"
                aria-label={`Quitar ajuste del ${a.date}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} noValidate className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="adj-date" className={labelClass}>Fecha</label>
            <input id="adj-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="adj-balance" className={labelClass}>Capital pendiente (€)</label>
            <input
              id="adj-balance"
              className={inputClass}
              inputMode="decimal"
              autoComplete="off"
              placeholder="89.512,34"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value);
                setError(undefined);
              }}
            />
          </div>
        </div>
        <FieldError message={error} />
        <button type="submit" disabled={busy} className="w-full rounded-lg border border-emerald-700 px-4 py-2 font-medium text-emerald-700 disabled:opacity-50">
          Añadir ajuste
        </button>
      </form>
    </section>
  );
}
