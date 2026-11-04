"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { TransactionForm } from "@/components/TransactionForm";
import { getRepository } from "@/lib/data";
import { todayIso } from "@/lib/domain/dates";
import { PERSONAL } from "@/lib/transactions-url";
import { useData } from "@/lib/use-data";

export default function NewTransactionPage() {
  return (
    <Suspense>
      <NewTransaction />
    </Suspense>
  );
}

function NewTransaction() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, error } = useData(async (repo) => {
    const [properties, categories] = await Promise.all([repo.listProperties(), repo.listCategories()]);
    return { properties, categories };
  });

  // Pre-fill property and category from the list filters, when valid.
  const piso = params.get("piso") ?? "";
  const propertyId = piso && piso !== PERSONAL && data?.properties.some((p) => p.id === piso) ? piso : "";
  const scope = propertyId ? "piso" : "personal";
  const categoria = params.get("categoria") ?? "";
  const categoryId = data?.categories.some((c) => c.id === categoria && c.scope === scope) ? categoria : "";

  return (
    <div className="space-y-4">
      <BackLink fallback="/movimientos" />
      <h1 className="text-2xl font-bold">Nuevo movimiento</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && (
        <TransactionForm
          initial={{ date: todayIso(), amount: "", categoryId, propertyId, concept: "" }}
          categories={data.categories}
          properties={data.properties}
          submitLabel="Añadir movimiento"
          onSubmit={async (value) => {
            await getRepository().createTransaction({ ...value, recurringId: null, confirmed: true });
            router.back();
          }}
        />
      )}
    </div>
  );
}
