"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { PendingBadge } from "@/components/PendingBadge";
import { Totals } from "@/components/Totals";
import { getRepository, type TransactionFilter } from "@/lib/data";
import { formatMonth, formatShortDate } from "@/lib/format";
import { PENDING, PERSONAL, transactionsHref } from "@/lib/transactions-url";
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
  const onlyPending = params.get("estado") === PENDING;
  const year = month ? "" : /^\d{4}$/.test(params.get("anio") ?? "") ? params.get("anio")! : "";

  // Filters live in the URL so cards can link here and "back" keeps them.
  const setFilter = (key: "mes" | "anio" | "piso" | "categoria" | "estado", value: string) => {
    const next = { mes: month, anio: year, piso: property, categoria: category, estado: onlyPending ? PENDING : "", [key]: value };
    router.replace(transactionsHref(next), { scroll: false });
  };

  const [version, setVersion] = useState(0);
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
    from: year ? `${year}-01-01` : undefined,
    to: year ? `${year}-12-31` : undefined,
    categoryId: category || undefined,
    propertyId: property === PERSONAL ? null : property || undefined,
    confirmed: onlyPending ? false : undefined,
  };
  const list = useData((repo) => repo.listTransactions(filter), [month, year, property, category, version]);
  const pending = useData((repo) => repo.listTransactions({ ...filter, confirmed: false }), [month, year, property, category, version]);

  async function confirm(ids: string[]) {
    const repo = getRepository();
    for (const id of ids) await repo.updateTransaction(id, { confirmed: true });
    setVersion((v) => v + 1);
  }

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

      {year && (
        <button
          type="button"
          onClick={() => setFilter("anio", "")}
          className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700"
          aria-label={`Quitar filtro del año ${year}`}
        >
          Año {year} ✕
        </button>
      )}

      {(pending.data?.length ?? 0) > 0 || onlyPending ? (
        <button
          type="button"
          onClick={() => setFilter("estado", onlyPending ? "" : PENDING)}
          aria-pressed={onlyPending}
          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${onlyPending ? "border-amber-500 bg-amber-100 text-amber-900" : "border-amber-300 bg-amber-50 text-amber-800"}`}
        >
          <span aria-hidden>⟳</span>
          <span className="flex-1">
            {pending.data?.length === 1 ? "1 automático pendiente" : `${pending.data?.length ?? 0} automáticos pendientes`} de confirmar
          </span>
          <span className="font-medium">{onlyPending ? "Ver todos" : "Ver"}</span>
        </button>
      ) : null}

      {list.error && <p className="text-rose-700">Error: {list.error}</p>}
      {list.data && (
        <>
          <div className="rounded-xl bg-white p-4 shadow-sm"><Totals transactions={list.data} /></div>
          {list.data.length === 0 ? (
            <p className="text-center text-slate-500">
              {onlyPending ? "No hay movimientos pendientes de confirmar." : "No hay movimientos."}
            </p>
          ) : (
            <>
              {onlyPending && (
                <button
                  type="button"
                  onClick={() => confirm(list.data!.map((t) => t.id))}
                  className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white"
                >
                  {list.data.length === 1 ? "Confirmar" : `Confirmar los ${list.data.length}`}
                </button>
              )}
              <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
                {list.data.map((t) => (
                  <li key={t.id} className={`flex items-center ${t.confirmed ? "" : "bg-amber-50/60"}`}>
                    <Link
                      href={`/movimientos/editar?id=${encodeURIComponent(t.id)}`}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-4 pr-2 active:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.concept || categories.get(t.categoryId)?.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {!t.confirmed && <PendingBadge />}
                          {formatShortDate(t.date)} · {categories.get(t.categoryId)?.name} ·{" "}
                          {t.propertyId ? properties.get(t.propertyId)?.name : "Personal"}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm"><Amount cents={t.amount} type={t.type} /></span>
                    </Link>
                    {t.confirmed ? (
                      <span className="w-2 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => confirm([t.id])}
                        aria-label={`Confirmar ${t.concept}`}
                        className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400 text-amber-700 active:bg-amber-100"
                      >
                        ✓
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
