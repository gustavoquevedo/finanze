"use client";

import { InvestmentTotals } from "@/components/InvestmentTotals";
import { INVERSIONES } from "@/components/nav-items";
import { SectionLinks } from "@/components/SectionHub";
import { sumValuations } from "@/lib/domain/investments";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

export default function InversionesPage() {
  const { data, error } = useData(async (repo) => {
    const { valuations } = await loadInvestments(repo);
    return sumValuations([...valuations.values()]);
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inversiones</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold">Todos los activos</h2>
          <InvestmentTotals totals={data} />
        </section>
      )}
      <SectionLinks section={INVERSIONES} />
    </div>
  );
}
