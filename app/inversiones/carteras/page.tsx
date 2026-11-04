"use client";

import Link from "next/link";
import { Gain } from "@/components/Gain";
import { portfolioView } from "@/lib/domain/investments";
import type { Portfolio } from "@/lib/domain/types";
import { formatCents } from "@/lib/format";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

/** Portfolios in tree order with their depth. */
function treeOrder(portfolios: Portfolio[]): { p: Portfolio; depth: number }[] {
  const out: { p: Portfolio; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const p of portfolios.filter((x) => x.parentId === parentId)) {
      out.push({ p, depth });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default function PortfoliosPage() {
  const { data, error } = useData(async (repo) => {
    const inv = await loadInvestments(repo);
    return treeOrder(inv.portfolios).map(({ p, depth }) => ({ depth, view: portfolioView(p.id, inv.portfolios, inv.valuations) }));
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Carteras</h1>
      <p className="text-sm text-slate-600">
        Un activo puede estar en varias carteras; cada cartera cuenta sus activos una sola vez, así que la suma de carteras puede no
        coincidir con el total.
      </p>
      <Link
        href="/inversiones/carteras/nueva"
        aria-label="Nueva cartera"
        className="fixed right-4 bottom-20 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl text-white shadow-lg"
      >
        +
      </Link>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data?.length === 0 && <p className="text-center text-slate-500">No hay carteras. Pulsa + para crear una.</p>}
      {data && data.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
          {data.map(({ depth, view }) => (
            <li key={view.portfolio.id}>
              <Link
                href={`/inversiones/carteras/ver?id=${encodeURIComponent(view.portfolio.id)}`}
                className="flex items-center justify-between gap-3 py-3 pr-4 active:bg-slate-50"
                style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
              >
                <span className="min-w-0 truncate font-medium">
                  {depth > 0 && <span aria-hidden className="mr-1 text-slate-300">└</span>}
                  {view.portfolio.name}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="block tabular-nums">{formatCents(view.totals.value)}</span>
                  <span className="block text-xs"><Gain cents={view.totals.gain} base={view.totals.purchaseValue} /></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
