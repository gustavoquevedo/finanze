"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { MortgageAdjustments } from "@/components/MortgageAdjustments";
import { MortgageForm } from "@/components/MortgageForm";
import { MortgageTable } from "@/components/MortgageTable";
import { RecurringForm } from "@/components/RecurringForm";
import { todayIso } from "@/lib/domain/dates";
import { planOf } from "@/lib/domain/recurring";
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
  const [version, setVersion] = useState(0);
  const { data, error } = useData(
    async (repo) => {
      const [recurrings, properties, categories] = await Promise.all([repo.listRecurrings(), repo.listProperties(), repo.listCategories()]);
      return { recurring: recurrings.find((r) => r.id === id) ?? null, properties, categories };
    },
    [id, version],
  );
  const r = data?.recurring;

  return (
    <div className="space-y-4">
      <BackLink fallback="/recurrentes" />
      <h1 className="text-2xl font-bold">{r?.kind === "hipoteca" ? "Hipoteca" : "Editar recurrente"}</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !r && <p className="text-slate-500">Este recurrente no existe o se ha eliminado.</p>}
      {data && r && r.kind === "hipoteca" && r.mortgage && (
        <div className="space-y-6">
          <MortgageForm
            key={`${r.id}-${version}`}
            creating={false}
            initial={{
              propertyId: r.propertyId ?? "",
              concept: r.concept,
              principal: centsToInput(r.mortgage.principal),
              annualRate: String(r.mortgage.annualRate).replace(".", ","),
              firstDate: r.startDate,
              lastDate: r.endDate ?? "",
              interestCategoryId: r.categoryId,
              principalCategoryId: r.mortgage.principalCategoryId,
              generateFrom: "",
              interestMethod: r.mortgage.interestMethod,
            }}
            adjustments={r.mortgage.adjustments}
            categories={data.categories}
            properties={data.properties}
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
          <MortgageAdjustments
            adjustments={r.mortgage.adjustments}
            onChange={async (adjustments) => {
              await getRepository().updateRecurring(r.id, { mortgage: { ...r.mortgage!, adjustments } });
              setVersion((v) => v + 1);
            }}
          />
          <MortgageTable plan={planOf(r)} today={todayIso()} fullHref={`/recurrentes/cuadro?id=${encodeURIComponent(r.id)}`} />
        </div>
      )}
      {data && r && r.kind !== "hipoteca" && (
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
