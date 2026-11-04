"use client";

import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { RecurringForm } from "@/components/RecurringForm";
import { loadRepository } from "@/lib/data";
import { todayIso } from "@/lib/domain/dates";
import { useData } from "@/lib/use-data";

export default function NewRecurringPage() {
  const router = useRouter();
  const { data, error } = useData(async (repo) => {
    const [properties, categories] = await Promise.all([repo.listProperties(), repo.listCategories()]);
    return { properties, categories };
  });

  return (
    <div className="space-y-4">
      <BackLink fallback="/recurrentes" />
      <h1 className="text-2xl font-bold">Nuevo recurrente</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && (
        <RecurringForm
          initial={{ propertyId: "", categoryId: "", amount: "", concept: "", frequency: "mensual", startDate: todayIso(), endDate: "" }}
          categories={data.categories}
          properties={data.properties}
          submitLabel="Crear recurrente"
          onSubmit={async (value) => {
            const repo = await loadRepository();
            await repo.createRecurring({ ...value, generatedUntil: null });
            // Create the occurrences already due (pending confirmation).
            await loadRepository();
            router.back();
          }}
        />
      )}
    </div>
  );
}
