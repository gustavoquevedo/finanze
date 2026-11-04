"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { Totals } from "@/components/Totals";
import type { TransactionFilter } from "@/lib/data";
import { formatMonth, formatShortDate } from "@/lib/format";
import { PERSONAL, transactionsHref } from "@/lib/transactions-url";
import { useData } from "@/lib/use-data";

export default function TransactionsPage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <TransactionsList />
    </Suspense>
  );
}

function TransactionsList() {
  const router = useRouter();
  const params = useSearchParams();
  const month = params.get("mes") ?? "";
  const property = params.get("piso") ?? "";
  const category = params.get("categoria") ?? "";

  // Filters live in the URL so cards can link here and "back" keeps them.
  const setFilter = (key: "mes" | "piso" | "categoria", value: string) => {
    const next = { mes: month, piso: property, categoria: category, [key]: value };
    router.replace(transactionsHref(next), { scroll: false });
  };

  const options = useData(async (repo) => {
    const [properties, categories, all] = await Promise.all([
      repo.listProperties(),
      repo.listCategories(),
      repo.listTransactions(),
    ]);
    return { properties, categories, months: [...new Set(all.map((t) => t.date.slice(0, 7)))] };
  });

  const filter: TransactionFilter = {
    month: month || undefined,
    categoryId: category || undefined,
    propertyId: property === PERSONAL ? null : property || undefined,
  };
  const list = useData((repo) => repo.listTransactions(filter), [month, property, category]);

  const categories = new Map(options.data?.categories.map((c) => [c.id, c]));
  const properties = new Map(options.data?.properties.map((p) => [p.id, p]));
  const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Movimientos</h1>
      <Link
        href={`/movimientos/nuevo${params.toString() ? `?${params.toString()}` : ""}`}
        aria-label="Nuevo movimiento"
        className="fixed right-4 bottom-20 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl text-white shadow-lg"
      >
        +
      </Link>

      <div className="grid grid-cols-3 gap-2">
        <select aria-label="Mes" className={selectClass} value={month} onChange={(e) => setFilter("mes", e.target.value)}>
          <option value="">Mes</option>
          {options.data?.months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
        <select aria-label="Piso" className={selectClass} value={property} onChange={(e) => setFilter("piso", e.target.value)}>
          <option value="">Todo</option>
          <option value={PERSONAL}>Personal</option>
          {options.data?.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Categoría" className={selectClass} value={category} onChange={(e) => setFilter("categoria", e.target.value)}>
          <option value="">Categorías</option>
          {options.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {list.error && <p className="text-rose-700">Error: {list.error}</p>}
      {list.data && (
        <>
          <div className="rounded-xl bg-white p-4 shadow-sm"><Totals transactions={list.data} /></div>
          {list.data.length === 0 ? (
            <p className="text-center text-slate-500">No hay movimientos.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
              {list.data.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/movimientos/editar?id=${encodeURIComponent(t.id)}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50"
                  >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.concept || categories.get(t.categoryId)?.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {formatShortDate(t.date)} · {categories.get(t.categoryId)?.name} ·{" "}
                      {t.propertyId ? properties.get(t.propertyId)?.name : "Personal"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm"><Amount cents={t.amount} type={t.type} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
