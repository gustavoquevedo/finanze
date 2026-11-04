"use client";

import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { PropertyForm } from "@/components/PropertyForm";
import { getRepository } from "@/lib/data";

export default function NewPropertyPage() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <BackLink fallback="/pisos" />
      <h1 className="text-2xl font-bold">Nuevo piso</h1>
      <PropertyForm
        initial={{
          name: "", address: "", purchaseDate: "", acquisitionPrice: "", purchaseCosts: "",
          cadastralValue: "", constructionPercentage: "", active: true,
        }}
        submitLabel="Crear piso"
        onSubmit={async (value) => {
          await getRepository().createProperty(value);
          router.back();
        }}
      />
    </div>
  );
}
