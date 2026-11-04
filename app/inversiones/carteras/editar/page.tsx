"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { PortfolioForm } from "@/components/PortfolioForm";
import { getRepository } from "@/lib/data";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

export default function EditPortfolioPage() {
  return (
    <Suspense>
      <EditPortfolio />
    </Suspense>
  );
}

function EditPortfolio() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(loadInvestments, [id]);
  const portfolio = data?.portfolios.find((p) => p.id === id);
  return (
    <div className="space-y-4">
      <BackLink fallback="/inversiones/carteras" />
      <h1 className="text-2xl font-bold">Editar cartera</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !portfolio && <p className="text-slate-500">Esta cartera no existe o se ha eliminado.</p>}
      {data && portfolio && (
        <PortfolioForm
          portfolio={portfolio}
          portfolios={data.portfolios}
          assets={data.assets}
          valuations={data.valuations}
          submitLabel="Guardar cambios"
          onSubmit={async (value) => {
            await getRepository().updatePortfolio(portfolio.id, value);
            router.back();
          }}
          onDelete={async () => {
            await getRepository().deletePortfolio(portfolio.id);
            router.replace("/inversiones/carteras");
          }}
        />
      )}
    </div>
  );
}
