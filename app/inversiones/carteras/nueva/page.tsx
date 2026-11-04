"use client";

import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { PortfolioForm } from "@/components/PortfolioForm";
import { getRepository } from "@/lib/data";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

export default function NewPortfolioPage() {
  const router = useRouter();
  const { data, error } = useData(loadInvestments);
  return (
    <div className="space-y-4">
      <BackLink fallback="/inversiones/carteras" />
      <h1 className="text-2xl font-bold">Nueva cartera</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && (
        <PortfolioForm
          portfolios={data.portfolios}
          assets={data.assets}
          valuations={data.valuations}
          submitLabel="Crear cartera"
          onSubmit={async (value) => {
            const p = await getRepository().createPortfolio(value);
            router.replace(`/inversiones/carteras/ver?id=${encodeURIComponent(p.id)}`);
          }}
        />
      )}
    </div>
  );
}
