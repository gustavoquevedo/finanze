"use client";

import Link from "next/link";
import { Totals } from "@/components/Totals";
import { todayIso } from "@/lib/domain/dates";
import { computeTotals } from "@/lib/domain/totals";
import { formatCents } from "@/lib/format";
import { transactionsHref } from "@/lib/transactions-url";
import { useData } from "@/lib/use-data";

export default function PropertiesPage() {
  const year = todayIso().slice(0, 4);
  const { data, error } = useData(async (repo) => {
    const [properties, transactions, categories] = await Promise.all([
      repo.listProperties(),
      repo.listTransactions({ from: `${year}-01-01`, to: `${year}-12-31` }),
      repo.listCategories(),
    ]);
    return properties.map((p) => ({
      property: p,
      totals: computeTotals(transactions.filter((t) => t.propertyId === p.id), categories),
    }));
  });

  const action = "rounded-lg border border-slate-200 px-2 py-2 text-center text-sm font-medium text-emerald-700 active:bg-slate-50";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pisos</h1>
      <Link
        href="/pisos/nuevo"
        aria-label="Nuevo piso"
        className="fixed right-4 bottom-20 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl text-white shadow-lg"
      >
        +
      </Link>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data?.length === 0 && <p className="text-center text-slate-500">No hay pisos. Pulsa + para añadir uno.</p>}
      {data?.map(({ property: p, totals }) => (
        <section key={p.id} className={`space-y-3 rounded-xl bg-white p-4 shadow-sm ${p.active ? "" : "opacity-70"}`}>
          <div>
            <h2 className="font-semibold">
              {p.name}
              {!p.active && <span className="font-normal text-slate-500"> (inactivo)</span>}
            </h2>
            {p.address && <p className="text-sm text-slate-500">{p.address}</p>}
            <p className="text-xs text-slate-500">
              Compra: {p.purchaseDate} · {formatCents(p.acquisitionPrice + p.purchaseCosts)} con gastos
            </p>
          </div>
          <p className="text-xs font-medium text-slate-500">Año {year}</p>
          <Totals totals={totals} />
          <div className="grid grid-cols-3 gap-2">
            <Link href={transactionsHref({ anio: year, piso: p.id })} className={action}>Movimientos</Link>
            <Link href={`/renta?piso=${encodeURIComponent(p.id)}&anio=${year}`} className={action}>Renta</Link>
            <Link href={`/pisos/editar?id=${encodeURIComponent(p.id)}`} className={action}>Editar</Link>
          </div>
        </section>
      ))}
    </div>
  );
}
