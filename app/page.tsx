"use client";

import Link from "next/link";
import { useState } from "react";
import { SummaryCard } from "@/components/SummaryCard";
import { restoreSeedData } from "@/lib/data";
import { computeTotals } from "@/lib/domain/totals";
import { formatMonth } from "@/lib/format";
import { PENDING, PERSONAL, transactionsHref } from "@/lib/transactions-url";
import { useData } from "@/lib/use-data";

export default function HomePage() {
  const { data, error, reload } = useData(async (repo) => {
    const [transactions, properties, categories] = await Promise.all([
      repo.listTransactions(),
      repo.listProperties(),
      repo.listCategories(),
    ]);
    const month = transactions[0]?.date.slice(0, 7) ?? null;
    const pending = transactions.filter((t) => !t.confirmed).length;
    return { month, properties, pending, categories, monthTx: month ? transactions.filter((t) => t.date.startsWith(month)) : [] };
  });
  const [restoring, setRestoring] = useState(false);

  async function handleRestore() {
    if (!window.confirm("Se borrarán todos los datos y se cargarán los datos de prueba. ¿Continuar?")) return;
    setRestoring(true);
    try {
      await restoreSeedData();
      reload();
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inicio</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && (
        <>
          {data.pending > 0 && (
            <Link
              href={transactionsHref({ estado: PENDING })}
              className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
            >
              <span aria-hidden>⟳</span>
              <span className="flex-1">
                {data.pending === 1 ? "1 movimiento automático" : `${data.pending} movimientos automáticos`} por confirmar
              </span>
              <span aria-hidden>›</span>
            </Link>
          )}
          <h2 className="text-sm font-medium text-slate-500">
            Resumen{data.month && ` de ${formatMonth(data.month).toLowerCase()}`}
          </h2>
          <SummaryCard title="Global" href={transactionsHref({ mes: data.month ?? undefined })} totals={computeTotals(data.monthTx, data.categories)} />
          <SummaryCard
            title="Personal"
            href={transactionsHref({ mes: data.month ?? undefined, piso: PERSONAL })}
            totals={computeTotals(data.monthTx.filter((t) => t.propertyId === null), data.categories)}
          />
          {data.properties.map((p) => (
            <SummaryCard
              key={p.id}
              title={p.name}
              href={transactionsHref({ mes: data.month ?? undefined, piso: p.id })}
              totals={computeTotals(data.monthTx.filter((t) => t.propertyId === p.id), data.categories)}
            />
          ))}
        </>
      )}
      <Link
        href="/resumen"
        className="flex items-center justify-between rounded-xl bg-white p-4 font-medium text-emerald-700 shadow-sm"
      >
        📊 Ver resumen anual <span aria-hidden>›</span>
      </Link>
      <section className="rounded-xl border border-dashed border-slate-300 p-4 text-sm">
        <p className="mb-3 text-slate-600">Los datos se guardan solo en este navegador.</p>
        <button
          type="button"
          onClick={handleRestore}
          disabled={restoring}
          className="w-full rounded-lg bg-slate-800 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {restoring ? "Restaurando…" : "Restaurar datos de prueba"}
        </button>
      </section>
    </div>
  );
}
