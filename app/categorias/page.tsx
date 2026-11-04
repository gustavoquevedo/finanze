"use client";

import Link from "next/link";
import type { Category, CategoryScope, TransactionType } from "@/lib/domain/types";
import { useData } from "@/lib/use-data";

const GROUPS: { scope: CategoryScope; type: TransactionType; title: string }[] = [
  { scope: "piso", type: "ingreso", title: "Pisos · Ingresos" },
  { scope: "piso", type: "gasto", title: "Pisos · Gastos" },
  { scope: "personal", type: "ingreso", title: "Personal · Ingresos" },
  { scope: "personal", type: "gasto", title: "Personal · Gastos" },
];

export default function CategoriesPage() {
  const { data, error } = useData(async (repo) => {
    const [categories, transactions, recurrings] = await Promise.all([
      repo.listCategories(),
      repo.listTransactions(),
      repo.listRecurrings(),
    ]);
    const uses = new Map<string, number>();
    for (const x of [...transactions, ...recurrings]) uses.set(x.categoryId, (uses.get(x.categoryId) ?? 0) + 1);
    return { categories, uses };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Categorías</h1>
      <Link
        href="/categorias/nueva"
        aria-label="Nueva categoría"
        className="fixed right-4 bottom-20 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl text-white shadow-lg"
      >
        +
      </Link>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data &&
        GROUPS.map((g) => {
          const items = data.categories.filter((c) => c.scope === g.scope && c.type === g.type);
          return (
            <section key={g.title} className="space-y-2">
              <h2 className="text-sm font-medium text-slate-500">{g.title}</h2>
              {items.length === 0 ? (
                <p className="text-sm text-slate-400">Sin categorías.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
                  {items.map((c) => <CategoryRow key={c.id} category={c} uses={data.uses.get(c.id) ?? 0} />)}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}

function CategoryRow({ category: c, uses }: { category: Category; uses: number }) {
  return (
    <li>
      <Link
        href={`/categorias/editar?id=${encodeURIComponent(c.id)}`}
        className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50"
      >
        <span className="min-w-0 truncate font-medium">{c.name}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
          {c.notExpense && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">No es gasto</span>}
          {c.deductible && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
              Deducible{c.limitedDeduction && " · límite"}
            </span>
          )}
          {uses === 0 ? "Sin usar" : uses === 1 ? "1 uso" : `${uses} usos`}
          <span aria-hidden className="text-slate-400">›</span>
        </span>
      </Link>
    </li>
  );
}
