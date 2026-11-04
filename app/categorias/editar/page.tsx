"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { CategoryForm } from "@/components/CategoryForm";
import { getRepository } from "@/lib/data";
import { useData } from "@/lib/use-data";

export default function EditCategoryPage() {
  return (
    <Suspense>
      <EditCategory />
    </Suspense>
  );
}

function EditCategory() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(
    async (repo) => {
      const [categories, transactions, recurrings] = await Promise.all([
        repo.listCategories(),
        repo.listTransactions({ categoryId: id }),
        repo.listRecurrings(),
      ]);
      return {
        categories,
        category: categories.find((c) => c.id === id) ?? null,
        usage: { transactions: transactions.length, recurrings: recurrings.filter((r) => r.categoryId === id).length },
      };
    },
    [id],
  );
  const c = data?.category;

  return (
    <div className="space-y-4">
      <BackLink fallback="/categorias" />
      <h1 className="text-2xl font-bold">Editar categoría</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !c && <p className="text-slate-500">Esta categoría no existe o se ha eliminado.</p>}
      {data && c && (
        <CategoryForm
          key={c.id}
          initial={{ name: c.name, scope: c.scope, type: c.type, deductible: c.deductible, notExpense: c.notExpense, limitedDeduction: c.limitedDeduction, icon: c.icon }}
          existing={data.categories}
          editingId={c.id}
          usage={data.usage}
          submitLabel="Guardar cambios"
          onSubmit={async (value) => {
            await getRepository().updateCategory(c.id, value);
            router.back();
          }}
          onDelete={async () => {
            await getRepository().deleteCategory(c.id);
            router.back();
          }}
        />
      )}
    </div>
  );
}
