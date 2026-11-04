"use client";

import Link from "next/link";
import { useState } from "react";
import { todayIso } from "@/lib/domain/dates";
import { everydayAccounts, isComputable, spendingByMonth, type MonthSpending } from "@/lib/domain/spending";
import { formatCents, formatMonth } from "@/lib/format";
import { useData } from "@/lib/use-data";

/** Recorded (darker) and unrecorded (lighter) parts of personal spending. */
const RECORDED = "#2a78d6";
const UNRECORDED = "#9ec5f4";

const reliable = (m: MonthSpending) => isComputable(m) && !m.current && m.unrecorded >= 0;

export default function EstimatedSpendingPage() {
  const today = todayIso();
  const { data, error } = useData(async (repo) => {
    const [transactions, categories, assets, snapshots] = await Promise.all([
      repo.listTransactions(),
      repo.listCategories(),
      repo.listAssets(),
      repo.listAssetSnapshots(),
    ]);
    return { months: spendingByMonth({ transactions, categories, assets, snapshots }, today, 12), accounts: everydayAccounts(assets).length };
  });

  const complete = data?.months.filter(reliable) ?? [];
  const average = complete.length ? Math.round(complete.reduce((s, m) => s + m.personalTotal, 0) / complete.length) : null;
  const latest = data?.months.find((m) => !m.current);
  const max = Math.max(1, ...(data?.months.map((m) => m.personalTotal) ?? [1]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gasto estimado</h1>
      <p className="text-sm text-slate-600">
        Lo que gastas sin apuntarlo, calculado como <b>ingresos − gastos registrados − ahorro</b>. El ahorro es lo que sube el saldo
        de tus cuentas del día a día, lo que aportas a fondos y el capital de la hipoteca. Necesita el saldo de cada cuenta a fin de
        mes:{" "}
        <Link href="/inversiones/saldos" className="font-medium text-emerald-700 underline">Saldos del mes</Link>.
      </p>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && data.accounts === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No hay cuentas del día a día. Crea tus cuentas como activos de tipo <b>Efectivo</b> en{" "}
          <Link href="/inversiones/activos" className="font-medium underline">Activos</Link> y apunta su saldo cada mes.
        </p>
      )}

      {latest && (
        <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{formatMonth(latest.month)}</h2>
            {average !== null && <span className="text-xs text-slate-500">Media: {formatCents(average)}/mes</span>}
          </div>
          {!isComputable(latest) ? (
            <MissingNotice month={latest} />
          ) : (
            <>
              <p className="flex items-baseline justify-between">
                <span className="text-slate-600">Gasto personal</span>
                <span className="text-2xl font-bold tabular-nums">{formatCents(latest.personalTotal)}</span>
              </p>
              <Breakdown m={latest} />
            </>
          )}
        </section>
      )}

      {data && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-500">Últimos 12 meses</h2>
            <span className="flex gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: RECORDED }} />Registrado</span>
              <span className="flex items-center gap-1"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: UNRECORDED }} />Sin registrar</span>
            </span>
          </div>
          <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
            {data.months.map((m) => (
              <MonthRow key={m.month} m={m} max={max} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MonthRow({ m, max }: { m: MonthSpending; max: number }) {
  const [open, setOpen] = useState(false);
  const usable = isComputable(m);
  const recorded = Math.max(0, m.personalExpenses);
  const unrecorded = Math.max(0, m.unrecorded);
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full space-y-1.5 px-4 py-3 text-left active:bg-slate-50">
        <span className="flex items-baseline justify-between gap-2">
          <span>
            {formatMonth(m.month)}
            {m.current && <span className="text-xs text-slate-500"> (en curso)</span>}
          </span>
          <span className="tabular-nums font-medium">
            {usable ? (
              formatCents(m.personalTotal)
            ) : (
              <span className="text-xs font-normal text-amber-800">{m.trackingStart ? "inicio del seguimiento" : "faltan saldos"}</span>
            )}
          </span>
        </span>
        {usable && (
          // Two-part bar: recorded + unrecorded personal spending, against the largest month.
          <span className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <span style={{ width: `${(recorded / max) * 100}%`, background: RECORDED }} />
            <span style={{ width: `${(unrecorded / max) * 100}%`, background: UNRECORDED, marginLeft: unrecorded && recorded ? 2 : 0 }} />
          </span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-3">
          {usable ? <Breakdown m={m} /> : <MissingNotice month={m} />}
        </div>
      )}
    </li>
  );
}

function Breakdown({ m }: { m: MonthSpending }) {
  const row = (label: string, value: number, sign: "+" | "−" | "=", strong = false) => (
    <div className={`flex justify-between gap-3 py-0.5 ${strong ? "border-t border-slate-200 pt-1.5 font-semibold" : ""}`}>
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular-nums">
        {sign === "=" ? "" : `${sign} `}
        {formatCents(Math.abs(value))}
        {sign !== "=" && value < 0 ? " (negativo)" : ""}
      </dd>
    </div>
  );
  return (
    <div className="space-y-2 text-sm">
      <dl>
        {row("Ingresos", m.income, "+")}
        {row("Gastos registrados", m.expenses, "−")}
        {row("Capital de la hipoteca", m.principal, "−")}
        {row(m.contributions >= 0 ? "Aportado a fondos" : "Retirado de fondos", m.contributions, m.contributions >= 0 ? "−" : "+")}
        {row(m.cashChange >= 0 ? "Sube el saldo de las cuentas" : "Baja el saldo de las cuentas", m.cashChange, m.cashChange >= 0 ? "−" : "+")}
        {row("Gastado sin registrar", m.unrecorded, "=", true)}
      </dl>
      <p className="text-xs text-slate-500">
        Gasto personal = {formatCents(m.personalExpenses)} registrados + {formatCents(Math.max(0, m.unrecorded))} sin registrar.
      </p>
      {m.unrecorded < 0 && (
        <p className="text-xs text-amber-800">
          Sale negativo: suele faltar algún ingreso por apuntar o el saldo de alguna cuenta.
        </p>
      )}
      {m.current && <p className="text-xs text-slate-500">Mes en curso: calculado hasta hoy con el último saldo apuntado.</p>}
    </div>
  );
}

function MissingNotice({ month: m }: { month: MonthSpending }) {
  if (m.trackingStart && m.missing.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Primer mes con saldos: son el punto de partida, no ahorro del mes. El cálculo empieza el mes siguiente.
      </p>
    );
  }
  return (
    <p className="text-sm text-amber-800">
      Falta el saldo de {m.missing.join(", ")} a fin de {formatMonth(m.month).toLowerCase()} o del mes anterior.{" "}
      <Link href={`/inversiones/saldos?mes=${m.month}`} className="font-medium underline">Apuntar saldos</Link>
    </p>
  );
}
