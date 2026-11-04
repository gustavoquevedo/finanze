"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { TransactionForm } from "@/components/TransactionForm";
import { getRepository } from "@/lib/data";
import { centsToInput } from "@/lib/domain/money";
import { useData } from "@/lib/use-data";

// The id goes in the query string (?id=) so the page can be prerendered statically.
export default function EditTransactionPage() {
  return (
    <Suspense>
      <EditTransaction />
    </Suspense>
  );
}

function EditTransaction() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(
    async (repo) => {
      const [transaction, properties, categories, recurrings] = await Promise.all([
        repo.getTransaction(id),
        repo.listProperties(),
        repo.listCategories(),
        repo.listRecurrings(),
      ]);
      const recurring = transaction?.recurringId ? recurrings.find((r) => r.id === transaction.recurringId) : undefined;
      return { transaction, properties, categories, recurring };
    },
    [id],
  );

  const t = data?.transaction;

  return (
    <div className="space-y-4">
      <BackLink fallback="/movimientos" />
      <h1 className="text-2xl font-bold">Editar movimiento</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !t && <p className="text-slate-500">Este movimiento no existe o se ha eliminado.</p>}
      {data && t && (
        <TransactionForm
          key={t.id}
          initial={{
            date: t.date,
            amount: centsToInput(t.amount),
            categoryId: t.categoryId,
            propertyId: t.propertyId ?? "",
            concept: t.concept,
          }}
          categories={data.categories}
          properties={data.properties}
          submitLabel="Guardar cambios"
          recurringNote={
            data.recurring
              ? `Generado por el recurrente «${data.recurring.concept}». Los cambios solo afectan a este movimiento.`
              : undefined
          }
          onSubmit={async (value) => {
            await getRepository().updateTransaction(t.id, value);
            router.back();
          }}
          onDelete={async () => {
            await getRepository().deleteTransaction(t.id);
            router.back();
          }}
        />
      )}
    </div>
  );
}
