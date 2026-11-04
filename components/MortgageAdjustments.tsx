"use client";

import { useState } from "react";
import { todayIso } from "@/lib/domain/dates";
import { parseEuros } from "@/lib/domain/money";
import type { MortgageAdjustment } from "@/lib/domain/types";
import { formatCents, formatShortDate } from "@/lib/format";
import { inputClass, labelClass } from "./form-styles";
import { FieldError } from "./TransactionForm";

/** List and add bank corrections: real outstanding principal and/or the bank's installment, from a date. */
export function MortgageAdjustments({
  adjustments,
  onChange,
}: {
  adjustments: MortgageAdjustment[];
  onChange: (next: MortgageAdjustment[]) => Promise<void>;
}) {
  const [date, setDate] = useState(todayIso());
  const [balance, setBalance] = useState("");
  const [payment, setPayment] = useState("");
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Indica la fecha.");
    const b = balance.trim() ? (balance.trim() === "0" ? 0 : parseEuros(balance)) : null;
    const p = payment.trim() ? parseEuros(payment) : null;
    if (balance.trim() && b === null) return setError("Capital pendiente no válido. Ejemplo: 89.512,34");
    if (payment.trim() && (p === null || p <= 0)) return setError("Cuota no válida. Ejemplo: 563,10");
    if (b === null && p === null) return setError("Indica el capital pendiente, la cuota o ambos.");
    await save([...adjustments.filter((a) => a.date !== date), { date, balance: b, payment: p }]);
    setBalance("");
    setPayment("");
    setError(undefined);
  }

  const clear = () => setError(undefined);

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Ajustes con los datos del banco</h2>
      <p className="text-sm text-slate-600">
        Si la cuota o el reparto no coinciden con tu banco, indica desde qué fecha y su <b>cuota</b>, su <b>capital pendiente</b> o
        ambos. Desde esa fecha los intereses se calculan sobre el capital pendiente y el resto de la cuota es amortización; las
        cuotas siguientes salen corregidas. Las ya creadas no cambian.
      </p>
      {sorted.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
          {sorted.map((a) => (
            <li key={a.date} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="shrink-0">Desde {formatShortDate(a.date)} {a.date.slice(0, 4)}</span>
              <span className="min-w-0 text-right text-xs">
                {a.payment !== null && <span className="block">cuota <b className="tabular-nums">{formatCents(a.payment)}</b></span>}
                {a.balance !== null && <span className="block">pendiente <b className="tabular-nums">{formatCents(a.balance)}</b></span>}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => window.confirm("¿Quitar este ajuste?") && void save(adjustments.filter((x) => x.date !== a.date))}
                className="shrink-0 px-1 text-rose-700"
                aria-label={`Quitar ajuste del ${a.date}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} noValidate className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div>
          <label htmlFor="adj-date" className={labelClass}>Desde</label>
          <input id="adj-date" type="date" className={inputClass} value={date} onChange={(e) => (setDate(e.target.value), clear())} />
          <p className="mt-1 text-xs text-slate-500">Se aplica a las cuotas posteriores a esta fecha.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="adj-payment" className={labelClass}>Cuota del banco (€)</label>
            <input
              id="adj-payment"
              className={inputClass}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Opcional"
              value={payment}
              onChange={(e) => (setPayment(e.target.value), clear())}
            />
          </div>
          <div>
            <label htmlFor="adj-balance" className={labelClass}>Capital pendiente (€)</label>
            <input
              id="adj-balance"
              className={inputClass}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Opcional"
              value={balance}
              onChange={(e) => (setBalance(e.target.value), clear())}
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
