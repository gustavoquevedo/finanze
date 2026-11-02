"use client";

import { Totals } from "@/components/Totals";
import { formatCents } from "@/lib/format";
import { useData } from "@/lib/use-data";

export default function PropertiesPage() {
  const { data, error } = useData(async (repo) => {
    const [properties, transactions] = await Promise.all([repo.listProperties(), repo.listTransactions()]);
    return properties.map((p) => ({ property: p, transactions: transactions.filter((t) => t.propertyId === p.id) }));
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pisos</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data?.length === 0 && <p className="text-center text-slate-500">No hay pisos.</p>}
      {data?.map(({ property: p, transactions }) => (
        <section key={p.id} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <h2 className="font-semibold">{p.name}{!p.active && <span className="text-slate-500"> (inactivo)</span>}</h2>
            <p className="text-sm text-slate-500">{p.address}</p>
            <p className="text-xs text-slate-500">
              Compra: {p.purchaseDate} · {formatCents(p.acquisitionPrice)} · Construcción {p.constructionPercentage}%
            </p>
          </div>
          <p className="text-xs text-slate-500">Total de los movimientos registrados</p>
          <Totals transactions={transactions} />
        </section>
      ))}
    </div>
  );
}
