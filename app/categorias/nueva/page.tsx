"use client";

import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { CategoryForm } from "@/components/CategoryForm";
import { getRepository } from "@/lib/data";
import { useData } from "@/lib/use-data";

export default function NewCategoryPage() {
  const router = useRouter();
  const { data, error } = useData((repo) => repo.listCategories());

  return (
    <div className="space-y-4">
      <BackLink fallback="/categorias" />
      <h1 className="text-2xl font-bold">Nueva categoría</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && (
        <CategoryForm
          initial={{ name: "", scope: "piso", type: "gasto", deductible: false }}
          existing={data}
          submitLabel="Crear categoría"
          onSubmit={async (value) => {
            await getRepository().createCategory(value);
            router.back();
          }}
        />
      )}
    </div>
  );
}
