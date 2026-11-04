"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { RecurringForm } from "@/components/RecurringForm";
import { getRepository, loadRepository } from "@/lib/data";
import { centsToInput } from "@/lib/domain/money";
import { useData } from "@/lib/use-data";

export default function EditRecurringPage() {
  return (
    <Suspense>
      <EditRecurring />
    </Suspense>
  );
}

function EditRecurring() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(
    async (repo) => {
      const [recurrings, properties, categories] = await Promise.all([repo.listRecurrings(), repo.listProperties(), repo.listCategories()]);
      return { recurring: recurrings.find((r) => r.id === id) ?? null, properties, categories };
    },
    [id],
  );
  const r = data?.recurring;

  return (
    <div className="space-y-4">
      <BackLink fallback="/recurrentes" />
      <h1 className="text-2xl font-bold">Editar recurrente</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !r && <p className="text-slate-500">Este recurrente no existe o se ha eliminado.</p>}
      {data && r && (
        <>
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Los cambios se aplican a los próximos movimientos. Los ya creados no cambian.
          </p>
          <RecurringForm
            key={r.id}
            initial={{
              propertyId: r.propertyId ?? "",
              categoryId: r.categoryId,
              amount: centsToInput(r.amount),
              concept: r.concept,
              frequency: r.frequency,
              startDate: r.startDate,
              endDate: r.endDate ?? "",
            }}
            categories={data.categories}
            properties={data.properties}
            generatedUntil={r.generatedUntil}
            submitLabel="Guardar cambios"
            onSubmit={async (value) => {
              await getRepository().updateRecurring(r.id, value);
              await loadRepository();
              router.back();
            }}
            onDelete={async () => {
              await getRepository().deleteRecurring(r.id);
              router.back();
            }}
          />
        </>
      )}
    </div>
  );
}
