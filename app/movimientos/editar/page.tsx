"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { PendingBadge } from "@/components/PendingBadge";
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
          submitLabel={t.confirmed ? "Guardar cambios" : "Confirmar"}
          recurringNote={
            !t.confirmed ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <PendingBadge /> Generado automáticamente
                {data.recurring && <> por «{data.recurring.concept}»</>}. Ya cuenta en los totales; revisa el importe y confírmalo.
              </p>
            ) : data.recurring ? (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                Generado por el recurrente «{data.recurring.concept}». Los cambios solo afectan a este movimiento.
              </p>
            ) : undefined
          }
          onSubmit={async (value) => {
            await getRepository().updateTransaction(t.id, { ...value, confirmed: true });
            router.back();
          }}
          secondary={
            t.confirmed
              ? undefined
              : {
                  label: "Guardar sin confirmar",
                  onSubmit: async (value) => {
                    await getRepository().updateTransaction(t.id, value);
                    router.back();
                  },
                }
          }
          onDelete={async () => {
            await getRepository().deleteTransaction(t.id);
            router.back();
          }}
        />
      )}
    </div>
  );
}
