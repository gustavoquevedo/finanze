"use client";

import { useState } from "react";
import type { Totals } from "@/lib/domain/investments";
import { formatCents } from "@/lib/format";
import { TimeChart, type ChartSeries } from "./charts/TimeChart";
import { formatPct, Gain } from "./Gain";

type Period = "6" | "12" | "all";
const PERIODS: { value: Period; label: string }[] = [
  { value: "6", label: "6 meses" },
  { value: "12", label: "1 año" },
  { value: "all", label: "Todo" },
];

const monthYear = new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" });
const money = (c: number) => formatCents(c).replace(/\s?€/, "");

/**
 * «Evolución» block: period selector, chart and a monthly table (newest first).
 * `chart` receives the visible range so the page decides what to draw.
 */
export function Evolution({
  dates,
  totals,
  chart,
  showInvested = true,
}: {
  dates: string[];
  totals: Totals[];
  chart: (range: { dates: string[]; from: number }) => { areas?: ChartSeries[]; lines?: ChartSeries[]; label: string };
  showInvested?: boolean;
}) {
  const [period, setPeriod] = useState<Period>("12");
  const [tableOpen, setTableOpen] = useState(false);
  const from = period === "all" ? 0 : Math.max(0, dates.length - Number(period) - 1);
  const visible = dates.slice(from);
  const { areas, lines, label } = chart({ dates: visible, from });
  const rows = visible.map((d, i) => ({ date: d, t: totals[from + i], prev: from + i > 0 ? totals[from + i - 1] : null })).reverse();

  return (
    <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Evolución</h2>
        <div role="radiogroup" aria-label="Periodo" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-2 py-1 font-medium ${period === p.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <TimeChart dates={visible} areas={areas} lines={lines} label={label} />

      <button type="button" onClick={() => setTableOpen((o) => !o)} aria-expanded={tableOpen} className="text-sm font-medium text-emerald-700">
        {tableOpen ? "Ocultar tabla" : "Ver tabla por meses"}
      </button>
      {tableOpen && (
        <div className="overflow-x-auto rounded-lg border border-slate-100 text-xs">
          <table className="min-w-full">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="sticky left-0 bg-white px-2 py-2 text-left font-medium">Mes</th>
                <th className="px-2 py-2 text-right font-medium">Valor</th>
                {showInvested && <th className="px-2 py-2 text-right font-medium">Invertido</th>}
                {showInvested && <th className="px-2 py-2 text-right font-medium">Plusvalía</th>}
                {showInvested && <th className="px-2 py-2 text-right font-medium">%</th>}
                {showInvested && <th className="px-2 py-2 text-right font-medium">Plusv. fiscal</th>}
                <th className="px-2 py-2 text-right font-medium">Variación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ date, t, prev }) => {
                const change = prev ? t.value - prev.value : null;
                return (
                  <tr key={date} className="border-b border-slate-50 tabular-nums last:border-0">
                    <td className="sticky left-0 bg-white px-2 py-1.5 text-left whitespace-nowrap capitalize">
                      {monthYear.format(new Date(date + "T00:00:00Z")).replace(".", "")}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{money(t.value)}</td>
                    {showInvested && <td className="px-2 py-1.5 text-right whitespace-nowrap">{money(t.purchaseValue)}</td>}
                    {showInvested && <td className="px-2 py-1.5 text-right whitespace-nowrap"><Gain cents={t.gain} showPct={false} /></td>}
                    {showInvested && <td className="px-2 py-1.5 text-right whitespace-nowrap">{t.purchaseValue ? formatPct(t.gain / t.purchaseValue) : "—"}</td>}
                    {showInvested && <td className="px-2 py-1.5 text-right whitespace-nowrap"><Gain cents={t.fiscalGain} showPct={false} /></td>}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{change === null ? "—" : <Gain cents={change} showPct={false} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
