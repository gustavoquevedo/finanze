"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Amount } from "@/components/Amount";
import { Totals } from "@/components/Totals";
import { todayIso } from "@/lib/domain/dates";
import { annualSummary, availableYears, type CategoryTotal, type DeductibleFilter } from "@/lib/domain/summary";
import { formatMonth } from "@/lib/format";
import { PERSONAL, transactionsHref } from "@/lib/transactions-url";
import { useData } from "@/lib/use-data";

/** Month table row: short month + three equal amount columns that fit 375px. */
const ROW = "grid grid-cols-[2.25rem_repeat(3,minmax(0,1fr))] gap-x-2 px-3";

const FILTERS: { value: DeductibleFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "deducibles", label: "Deducibles" },
  { value: "no-deducibles", label: "No deducibles" },
];

export default function SummaryPage() {
  return (
    <Suspense>
      <Summary />
    </Suspense>
  );
}

function Summary() {
  const router = useRouter();
  const params = useSearchParams();
  const currentYear = Number(todayIso().slice(0, 4));
  const year = Number(params.get("anio")) || currentYear;
  const piso = params.get("piso") ?? "";
  const gastos = (FILTERS.find((f) => f.value === params.get("gastos"))?.value ?? "todos") as DeductibleFilter;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/resumen${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const { data, error } = useData(async (repo) => {
    const [transactions, categories, properties] = await Promise.all([
      repo.listTransactions(),
      repo.listCategories(),
      repo.listProperties(),
    ]);
    return { transactions, categories, properties, years: availableYears(transactions, currentYear) };
  });

  const propertyId = piso === PERSONAL ? null : piso || undefined;
  const summary = data ? annualSummary(data.transactions, data.categories, { year, propertyId, deductible: gastos }) : null;
  const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm";
  const linkFor = (categoryId?: string, month?: string) =>
    transactionsHref({ anio: month ? undefined : String(year), mes: month, piso: piso || undefined, categoria: categoryId });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Resumen anual</h1>

      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Año" className={selectClass} value={year} onChange={(e) => setParam("anio", e.target.value)}>
          {(data?.years ?? [year]).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Piso" className={selectClass} value={piso} onChange={(e) => setParam("piso", e.target.value)}>
          <option value="">Global</option>
          <option value={PERSONAL}>Personal</option>
          {data?.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Gastos</p>
        <div role="radiogroup" aria-label="Gastos" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={gastos === f.value}
              onClick={() => setParam("gastos", f.value === "todos" ? "" : f.value)}
              className={`rounded-md px-2 py-2 text-sm font-medium ${gastos === f.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-rose-700">Error: {error}</p>}
      {summary && (
        <>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Total {year}</h2>
            <Totals totals={summary.totals} />
            {summary.pending > 0 && (
              <p className="mt-2 text-xs text-amber-800">
                Incluye {summary.pending === 1 ? "1 movimiento automático" : `${summary.pending} movimientos automáticos`} sin confirmar.
              </p>
            )}
            {gastos === "deducibles" && (
              <p className="mt-2 text-xs text-slate-500">
                Ingresos completos y solo gastos deducibles. Orientativo: no sustituye a un asesor.
              </p>
            )}
          </section>

          <CategorySection title="Ingresos" items={summary.income} type="ingreso" linkFor={linkFor} />
          <CategorySection title="Gastos" items={summary.expense} type="gasto" linkFor={linkFor} />

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-500">Por meses</h2>
            <div className="rounded-xl bg-white shadow-sm">
              <div className={`${ROW} border-b border-slate-100 py-2 text-xs text-slate-500`}>
                <span>Mes</span>
                <span className="text-right">Ingresos</span>
                <span className="text-right">Gastos</span>
                <span className="text-right">Neto</span>
              </div>
              {summary.months.map((m) => {
                const empty = m.income === 0 && m.expense === 0;
                return (
                  <Link
                    key={m.month}
                    href={linkFor(undefined, m.month)}
                    className={`${ROW} items-center border-b border-slate-50 py-2 text-xs last:border-0 active:bg-slate-50 ${empty ? "text-slate-300" : ""}`}
                  >
                    <span className="text-sm capitalize">{formatMonth(m.month).slice(0, 3)}</span>
                    <span className="text-right tabular-nums">{empty ? "—" : <Amount cents={m.income} />}</span>
                    <span className="text-right tabular-nums">{empty ? "—" : <Amount cents={m.expense} />}</span>
                    <span className="text-right font-medium tabular-nums">{empty ? "—" : <Amount cents={m.net} />}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CategorySection({
  title,
  items,
  type,
  linkFor,
}: {
  title: string;
  items: CategoryTotal[];
  type: "ingreso" | "gasto";
  linkFor: (categoryId: string) => string;
}) {
  const total = items.reduce((s, x) => s + x.amount, 0);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-slate-500">{title} por categoría</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Sin movimientos.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
          {items.map(({ category, amount, count }) => (
            <li key={category.id}>
              <Link href={linkFor(category.id)} className="block px-4 py-3 active:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{category.name}</span>
                  <span className="shrink-0 text-sm"><Amount cents={amount} type={type} /></span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${type === "gasto" ? "bg-rose-400" : "bg-emerald-500"}`}
                      style={{ width: `${total ? (amount / total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-right text-xs text-slate-500">
                    {category.deductible && <span className="mr-1 rounded bg-emerald-50 px-1 font-medium text-emerald-700">Deducible</span>}
                    {total ? Math.round((amount / total) * 100) : 0}% · {count} mov.
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
