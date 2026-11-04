"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, Suspense, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { Donut } from "@/components/Donut";
import { formatPct, Gain } from "@/components/Gain";
import { InvestmentTotals } from "@/components/InvestmentTotals";
import {
  allocationByType,
  portfolioAssetIds,
  portfolioView,
  type AssetValuation,
  type PortfolioChild,
  type Totals,
} from "@/lib/domain/investments";
import type { Portfolio } from "@/lib/domain/types";
import { formatCents } from "@/lib/format";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

export default function PortfolioPage() {
  return (
    <Suspense>
      <PortfolioDetail />
    </Suspense>
  );
}

const money = (c: number) => formatCents(c).replace(/\s?€/, "");
const shortDate = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "—");
const cell = "px-2 py-2 text-right tabular-nums whitespace-nowrap";

function PortfolioDetail() {
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(loadInvestments, [id]);
  const portfolio = data?.portfolios.find((p) => p.id === id);
  const view = data && portfolio ? portfolioView(portfolio.id, data.portfolios, data.valuations) : null;
  const parent = portfolio?.parentId ? data?.portfolios.find((p) => p.id === portfolio.parentId) : undefined;
  const [groupBy, setGroupBy] = useState<"activos" | "tipos">("activos");

  return (
    <div className="space-y-4">
      <BackLink fallback="/inversiones/carteras" />
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !portfolio && <p className="text-slate-500">Esta cartera no existe o se ha eliminado.</p>}
      {data && view && portfolio && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{portfolio.name}</h1>
              {parent && (
                <Link href={`/inversiones/carteras/ver?id=${encodeURIComponent(parent.id)}`} className="text-sm text-slate-500">
                  Dentro de {parent.name} ›
                </Link>
              )}
            </div>
            <Link
              href={`/inversiones/carteras/editar?id=${encodeURIComponent(portfolio.id)}`}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              Editar
            </Link>
          </div>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <InvestmentTotals totals={view.totals} />
          </section>

          {view.children.length === 0 ? (
            <p className="text-center text-slate-500">Esta cartera no tiene activos. Pulsa Editar para añadirlos.</p>
          ) : (
            <>
              <section className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Pesos</h2>
                  <div role="radiogroup" aria-label="Agrupar por" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
                    {(["activos", "tipos"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        role="radio"
                        aria-checked={groupBy === g}
                        onClick={() => setGroupBy(g)}
                        className={`rounded-md px-3 py-1 font-medium ${groupBy === g ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
                      >
                        {g === "activos" ? "Activos" : "Tipos"}
                      </button>
                    ))}
                  </div>
                </div>
                {groupBy === "tipos" ? (
                  <Donut
                    slices={allocationByType(portfolioAssetIds(portfolio.id, data.portfolios), data.assets, data.assetTypes, data.valuations)}
                    showValues
                  />
                ) : (
                  <Donut slices={view.children.map((c) => ({ id: c.id, name: c.name, value: c.totals.value }))} />
                )}
                {groupBy === "activos" && view.overlap && (
                  <p className="mt-2 text-xs text-amber-800">
                    Algún activo está en varias subcarteras: los pesos del gráfico son sobre la suma de las partes, y en la tabla suman más del 100 %.
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h2 className="font-semibold">Detalle</h2>
                <PortfolioTable view={view} portfolios={data.portfolios} valuations={data.valuations} />
                <p className="text-xs text-slate-500">Importes en €. Desliza la tabla para ver todas las columnas; pulsa una subcartera para desplegarla.</p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PortfolioTable({
  view,
  portfolios,
  valuations,
}: {
  view: ReturnType<typeof portfolioView>;
  portfolios: Portfolio[];
  valuations: Map<string, AssetValuation>;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = (children: PortfolioChild[], depth: number, base: number): React.ReactNode =>
    children.map((c) => {
      const isOpen = c.type === "cartera" && open.has(c.id);
      return (
        <Fragment key={`${depth}-${c.id}`}>
          <Row child={c} depth={depth} weight={base ? c.totals.value / base : 0} open={isOpen} onToggle={c.type === "cartera" ? () => toggle(c.id) : undefined} />
          {isOpen && rows(portfolioView(c.id, portfolios, valuations).children, depth + 1, base)}
        </Fragment>
      );
    });

  return (
    // Wide table: it scrolls sideways inside its card; the name column stays visible.
    <div className="overflow-x-auto rounded-xl bg-white text-xs shadow-sm">
      <table className="min-w-full">
        <thead className="text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium">Nombre</th>
            <th className={`${cell} font-medium`}>Valor</th>
            <th className={`${cell} font-medium`}>Peso</th>
            <th className={`${cell} font-medium`}>Compra</th>
            <th className={`${cell} font-medium`}>Plusvalía</th>
            <th className={`${cell} font-medium`}>%</th>
            <th className={`${cell} font-medium`}>Coste fiscal</th>
            <th className={`${cell} font-medium`}>Plusv. fiscal</th>
            <th className={`${cell} font-medium`}>Fecha</th>
          </tr>
        </thead>
        <tbody>{rows(view.children, 0, view.totals.value)}</tbody>
        <tfoot>
          <TotalRow totals={view.totals} />
        </tfoot>
      </table>
    </div>
  );
}

function Row({ child: c, depth, weight, open, onToggle }: { child: PortfolioChild; depth: number; weight: number; open: boolean; onToggle?: () => void }) {
  const t = c.totals;
  const empty = t.value === 0 && t.missing > 0;
  const name = (
    <span className="flex items-center gap-1" style={{ paddingLeft: `${depth * 0.75}rem` }}>
      {c.type === "cartera" ? (
        <span aria-hidden className={`inline-block text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      ) : (
        <span aria-hidden className="inline-block w-[0.4rem]" />
      )}
      <span className={`max-w-[8.5rem] truncate ${c.type === "cartera" ? "font-semibold" : ""}`}>{c.name}</span>
    </span>
  );
  return (
    <tr className={`border-b border-slate-50 ${depth > 0 ? "bg-slate-50/60" : ""}`}>
      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-left" style={{ background: depth > 0 ? "#f8fafc" : "#ffffff" }}>
        {onToggle ? (
          <button type="button" onClick={onToggle} aria-expanded={open} className="text-left">
            {name}
          </button>
        ) : c.valuation ? (
          <Link href={`/inversiones/activos/editar?id=${encodeURIComponent(c.id)}`}>{name}</Link>
        ) : (
          name
        )}
      </td>
      <td className={cell}>{empty ? "—" : money(t.value)}</td>
      <td className={cell}>{empty ? "—" : formatPct(weight).replace("+", "")}</td>
      <td className={cell}>{empty ? "—" : money(t.purchaseValue)}</td>
      <td className={cell}>{empty ? "—" : <Gain cents={t.gain} showPct={false} />}</td>
      <td className={cell}>{empty || !t.purchaseValue ? "—" : formatPct(t.gain / t.purchaseValue)}</td>
      <td className={cell}>{empty ? "—" : money(t.fiscalCost)}</td>
      <td className={cell}>{empty ? "—" : <Gain cents={t.fiscalGain} showPct={false} />}</td>
      <td className={`${cell} text-slate-500`}>{c.valuation ? shortDate(c.valuation.valueDate) : ""}</td>
    </tr>
  );
}

function TotalRow({ totals: t }: { totals: Totals }) {
  return (
    <tr className="border-t border-slate-200 font-semibold">
      <td className="sticky left-0 z-10 bg-white px-3 py-2 text-left">Total</td>
      <td className={cell}>{money(t.value)}</td>
      <td className={cell}>100 %</td>
      <td className={cell}>{money(t.purchaseValue)}</td>
      <td className={cell}><Gain cents={t.gain} showPct={false} /></td>
      <td className={cell}>{t.purchaseValue ? formatPct(t.gain / t.purchaseValue) : "—"}</td>
      <td className={cell}>{money(t.fiscalCost)}</td>
      <td className={cell}><Gain cents={t.fiscalGain} showPct={false} /></td>
      <td className={cell} />
    </tr>
  );
}
