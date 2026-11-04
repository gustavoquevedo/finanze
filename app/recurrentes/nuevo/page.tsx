"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { MortgageForm } from "@/components/MortgageForm";
import { RecurringForm } from "@/components/RecurringForm";
import { getRepository, loadRepository } from "@/lib/data";
import { todayIso } from "@/lib/domain/dates";
import { useData } from "@/lib/use-data";

export default function NewRecurringPage() {
  return (
    <Suspense>
      <NewRecurring />
    </Suspense>
  );
}

function NewRecurring() {
  const router = useRouter();
  const mortgage = useSearchParams().get("tipo") === "hipoteca";
  const { data, error } = useData(async (repo) => {
    const [properties, categories] = await Promise.all([repo.listProperties(), repo.listCategories()]);
    return { properties, categories };
  });

  const done = async () => {
    // Create the occurrences already due (pending confirmation).
    await loadRepository();
    router.back();
  };

  return (
    <div className="space-y-4">
      <BackLink fallback="/recurrentes" />
      <h1 className="text-2xl font-bold">{mortgage ? "Nueva hipoteca" : "Nuevo recurrente"}</h1>
      <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {[
          { value: false, label: "Importe fijo" },
          { value: true, label: "Hipoteca" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={mortgage === o.value}
            onClick={() => router.replace(o.value ? "/recurrentes/nuevo?tipo=hipoteca" : "/recurrentes/nuevo")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${mortgage === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !mortgage && (
        <RecurringForm
          initial={{ propertyId: "", categoryId: "", amount: "", concept: "", frequency: "mensual", startDate: todayIso(), endDate: "" }}
          categories={data.categories}
          properties={data.properties}
          submitLabel="Crear recurrente"
          onSubmit={async (value) => {
            await getRepository().createRecurring({ ...value, generatedUntil: null });
            await done();
          }}
        />
      )}
      {data && mortgage && (
        <MortgageForm
          creating
          initial={{
            propertyId: "", concept: "", principal: "", annualRate: "", firstDate: "", lastDate: "",
            interestCategoryId: "", principalCategoryId: "", generateFrom: "",
          }}
          categories={data.categories}
          properties={data.properties}
          submitLabel="Crear hipoteca"
          onSubmit={async (value, generatedUntil) => {
            await getRepository().createRecurring({ ...value, generatedUntil });
            await done();
          }}
        />
      )}
    </div>
  );
}
