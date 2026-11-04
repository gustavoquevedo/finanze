"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SummaryCard } from "@/components/SummaryCard";
import { dataMode, isEmpty, lastBackupAt } from "@/lib/data";
import { computeTotals } from "@/lib/domain/totals";
import { formatMonth } from "@/lib/format";
import { PENDING, PERSONAL, transactionsHref } from "@/lib/transactions-url";
import { useData } from "@/lib/use-data";

export default function HomePage() {
  const { data, error } = useData(async (repo) => {
    const [transactions, properties, categories] = await Promise.all([
      repo.listTransactions(),
      repo.listProperties(),
      repo.listCategories(),
    ]);
    const month = transactions[0]?.date.slice(0, 7) ?? null;
    const pending = transactions.filter((t) => !t.confirmed).length;
    return { month, properties, pending, categories, monthTx: month ? transactions.filter((t) => t.date.startsWith(month)) : [] };
  });
  // Read after mounting: the page is prerendered without access to the browser storage.
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    setLastBackup(lastBackupAt());
    void isEmpty().then(setEmpty);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inicio</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {empty && (
        <Link href="/datos" className="block space-y-1 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <span className="block font-semibold">{dataMode === "supabase" ? "Tu cuenta está vacía" : "No hay datos todavía"}</span>
          <span className="block text-sm text-slate-700">
            {dataMode === "supabase" ? "Sube los datos de este navegador, importa" : "Importa"} una copia, los datos de demostración o
            los de prueba desde Datos y copia ›
          </span>
        </Link>
      )}
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
      <Link href="/datos" className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm">
        <span aria-hidden className="text-xl">💾</span>
        <span className="flex-1">
          <span className="block font-medium">Datos y copia de seguridad</span>
          <span className="block text-slate-600">
            {dataMode === "supabase" ? "Los datos se guardan en tu cuenta." : "Los datos se guardan solo en este navegador."}{" "}
            {lastBackup ? `Última copia: ${new Date(lastBackup).toLocaleDateString("es-ES")}.` : "Aún no has hecho ninguna copia."}
          </span>
        </span>
        <span aria-hidden className="text-slate-400">›</span>
      </Link>
    </div>
  );
}
