"use client";

import Link from "next/link";
import { Donut } from "@/components/Donut";
import { InvestmentTotals } from "@/components/InvestmentTotals";
import { INVERSIONES } from "@/components/nav-items";
import { SectionLinks } from "@/components/SectionHub";
import { allocationByType, sumValuations } from "@/lib/domain/investments";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

export default function InversionesPage() {
  const { data, error } = useData(async (repo) => {
    const inv = await loadInvestments(repo);
    return {
      totals: sumValuations([...inv.valuations.values()]),
      byType: allocationByType(inv.assets.map((a) => a.id), inv.assets, inv.assetTypes, inv.valuations),
    };
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inversiones</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold">Todos los activos</h2>
          <InvestmentTotals totals={data.totals} />
        </section>
      )}
      {data && data.byType.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Reparto por tipo de activo</h2>
            <Link href="/inversiones/tipos" className="text-sm font-medium text-emerald-700">Tipos ›</Link>
          </div>
          <Donut slices={data.byType} showValues />
        </section>
      )}
      <SectionLinks section={INVERSIONES} />
    </div>
  );
}
