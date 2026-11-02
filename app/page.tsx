"use client";

import { useState } from "react";
import { Totals } from "@/components/Totals";
import { restoreSeedData } from "@/lib/data";
import { formatMonth } from "@/lib/format";
import { useData } from "@/lib/use-data";

export default function HomePage() {
  const { data, error, reload } = useData(async (repo) => {
    const [transactions, properties] = await Promise.all([repo.listTransactions(), repo.listProperties()]);
    const month = transactions[0]?.date.slice(0, 7) ?? null;
    return { month, properties, monthTx: month ? transactions.filter((t) => t.date.startsWith(month)) : [] };
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
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">
              Global{data.month && <span className="font-normal text-slate-500"> · {formatMonth(data.month)}</span>}
            </h2>
            <Totals transactions={data.monthTx} />
          </section>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Personal</h2>
            <Totals transactions={data.monthTx.filter((t) => t.propertyId === null)} />
          </section>
          {data.properties.map((p) => (
            <section key={p.id} className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">{p.name}</h2>
              <Totals transactions={data.monthTx.filter((t) => t.propertyId === p.id)} />
            </section>
          ))}
        </>
      )}
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
