"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { PropertyForm } from "@/components/PropertyForm";
import { getRepository } from "@/lib/data";
import { centsToInput } from "@/lib/domain/money";
import { useData } from "@/lib/use-data";

export default function EditPropertyPage() {
  return (
    <Suspense>
      <EditProperty />
    </Suspense>
  );
}

function EditProperty() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(
    async (repo) => {
      const [property, transactions, recurrings] = await Promise.all([
        repo.getProperty(id),
        repo.listTransactions({ propertyId: id }),
        repo.listRecurrings(),
      ]);
      return { property, transactions: transactions.length, recurrings: recurrings.filter((r) => r.propertyId === id).length };
    },
    [id],
  );
  const p = data?.property;

  return (
    <div className="space-y-4">
      <BackLink fallback="/pisos" />
      <h1 className="text-2xl font-bold">Editar piso</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !p && <p className="text-slate-500">Este piso no existe o se ha eliminado.</p>}
      {data && p && (
        <PropertyForm
          key={p.id}
          initial={{
            name: p.name,
            address: p.address,
            purchaseDate: p.purchaseDate,
            acquisitionPrice: centsToInput(p.acquisitionPrice),
            purchaseCosts: p.purchaseCosts ? centsToInput(p.purchaseCosts) : "",
            cadastralValue: p.cadastralValue !== null ? centsToInput(p.cadastralValue) : "",
            constructionPercentage: String(p.constructionPercentage).replace(".", ","),
            active: p.active,
          }}
          submitLabel="Guardar cambios"
          onSubmit={async (value) => {
            await getRepository().updateProperty(p.id, value);
            router.back();
          }}
          deleteWarning={`¿Eliminar «${p.name}»? Se borrarán también sus ${data.transactions} movimientos y ${data.recurrings} recurrentes. No se puede deshacer.`}
          onDelete={async () => {
            await getRepository().deleteProperty(p.id);
            router.replace("/pisos");
          }}
        />
      )}
    </div>
  );
}
