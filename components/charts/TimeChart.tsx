"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SERIES_COLORS } from "@/components/Donut";
import { formatCents } from "@/lib/format";
import { Icon } from "@/lib/icons/Icon";

export interface ChartSeries {
  id: string;
  name: string;
  /** Fixed colour slot; `null` = uncategorised grey; past the palette folds into «Otros». */
  colorIndex: number | null;
  icon?: string | null;
  /** Cents, one per date (null = no value). */
  values: (number | null)[];
}

interface Props {
  dates: string[];
  /** Stacked areas (bottom to top, in order). */
  areas?: ChartSeries[];
  /** Lines drawn on top (not stacked), e.g. total or amount invested. */
  lines?: (ChartSeries & { color?: string })[];
  label: string;
  height?: number;
}

const UNCATEGORISED = "#a3a3a3";
const OTHER = "#d4d4d4";
const GRID = "#e2e8f0";
const AXIS_TEXT = "#64748b";
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

const monthShort = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const compact = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });
const asDate = (iso: string) => new Date(iso + "T00:00:00Z");

/** Colour of a series, folding slots past the palette into «Otros». */
function foldSeries(series: ChartSeries[]): (ChartSeries & { color: string })[] {
  const out: (ChartSeries & { color: string })[] = [];
  let other: (ChartSeries & { color: string }) | null = null;
  for (const s of series) {
    if (s.colorIndex === null) out.push({ ...s, color: UNCATEGORISED });
    else if (s.colorIndex < SERIES_COLORS.length) out.push({ ...s, color: SERIES_COLORS[s.colorIndex] });
    else {
      other ??= { id: "__otros", name: "Otros", colorIndex: null, values: s.values.map(() => 0), color: OTHER };
      other.values = other.values.map((v, i) => (v ?? 0) + (s.values[i] ?? 0));
    }
  }
  // «Sin tipo» and «Otros» go on top of the stack.
  return [...out.filter((s) => s.color !== UNCATEGORISED), ...out.filter((s) => s.color === UNCATEGORISED), ...(other ? [other] : [])];
}

/** Round step for about `count` ticks up to `max`. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/**
 * Time chart: stacked areas and/or lines over monthly dates. A crosshair follows the pointer (or
 * the arrow keys when focused) and a tooltip lists every series at that date.
 */
export function TimeChart({ dates, areas = [], lines = [], label, height = 220 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stacked = useMemo(() => foldSeries(areas), [areas]);
  const drawnLines = useMemo(
    () => lines.map((l, i) => ({ ...l, color: l.color ?? (l.colorIndex === null ? "#334155" : SERIES_COLORS[l.colorIndex % SERIES_COLORS.length] ?? "#334155"), key: i })),
    [lines],
  );

  if (dates.length < 2) {
    return <p className="py-6 text-center text-sm text-slate-500">Hace falta más de un mes de datos para ver la evolución.</p>;
  }

  // Cumulative tops of the stack, in cents.
  const tops = stacked.map((_, si) => dates.map((__, di) => stacked.slice(0, si + 1).reduce((s, x) => s + (x.values[di] ?? 0), 0)));
  const maxValue = Math.max(1, ...(tops.at(-1) ?? [0]), ...drawnLines.flatMap((l) => l.values.map((v) => v ?? 0)));
  const ticks = niceTicks(maxValue / 100).map((t) => t * 100);
  const yMax = ticks[ticks.length - 1];
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (dates.length === 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const areaPath = (si: number) => {
    const top = tops[si].map((v, i) => `${x(i)},${y(v)}`);
    const bottom = (si === 0 ? dates.map(() => 0) : tops[si - 1]).map((v, i) => `${x(i)},${y(v)}`).reverse();
    return `M${top.join("L")}L${bottom.join("L")}Z`;
  };
  const linePath = (values: (number | null)[]) => {
    let d = "";
    values.forEach((v, i) => {
      if (v === null) return;
      d += `${d && values[i - 1] !== null ? "L" : "M"}${x(i)},${y(v)}`;
    });
    return d;
  };

  const labelEvery = Math.max(1, Math.ceil(dates.length / Math.max(2, Math.floor(innerW / 56))));
  const current = index === null ? null : Math.min(index, dates.length - 1);

  function onPointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - PAD.left) / innerW) * (dates.length - 1));
    setIndex(Math.max(0, Math.min(dates.length - 1, i)));
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setIndex((i) => Math.max(0, Math.min(dates.length - 1, (i ?? dates.length - 1) + step)));
    } else if (e.key === "Escape") setIndex(null);
  }

  const tooltipWidth = Math.min(232, width);
  const tooltipLeft = current === null ? 0 : Math.min(Math.max(x(current) - tooltipWidth / 2, 0), width - tooltipWidth);
  const stackTotal = current === null ? 0 : (tops.at(-1)?.[current] ?? 0);

  return (
    <div className="space-y-3">
      <div ref={wrap} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setIndex(null)}
          onKeyDown={onKey}
          onBlur={() => setIndex(null)}
          className="touch-pan-y rounded outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
                {compact.format(t / 100)}
              </text>
            </g>
          ))}
          {dates.map((d, i) =>
            i % labelEvery === 0 || i === dates.length - 1 ? (
              <text key={d} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"} fontSize={11} fill={AXIS_TEXT}>
                {monthShort.format(asDate(d)).replace(".", "")}
                {d.slice(5, 7) === "01" || i === 0 ? ` ${d.slice(2, 4)}` : ""}
              </text>
            ) : null,
          )}
          {/* Stacked areas, separated by a thin surface-colour edge. */}
          {stacked.map((s, si) => (
            <path key={s.id} d={areaPath(si)} fill={s.color} fillOpacity={0.75} stroke="#ffffff" strokeWidth={1.5} strokeLinejoin="round" />
          ))}
          {drawnLines.map((l) => (
            <path key={l.key} d={linePath(l.values)} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {current !== null && (
            <g pointerEvents="none">
              <line x1={x(current)} x2={x(current)} y1={PAD.top} y2={PAD.top + innerH} stroke="#334155" strokeWidth={1} />
              {drawnLines.map((l) =>
                l.values[current] !== null ? (
                  <circle key={l.key} cx={x(current)} cy={y(l.values[current]!)} r={4} fill={l.color} stroke="#ffffff" strokeWidth={2} />
                ) : null,
              )}
            </g>
          )}
        </svg>
        {current !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white/95 p-2 text-xs shadow-md"
            style={{ left: tooltipLeft, width: tooltipWidth }}
          >
            <p className="mb-1 font-semibold text-slate-900">{monthLong.format(asDate(dates[current]))}</p>
            {[...stacked].reverse().map((s) => (
              <p key={s.id} className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-slate-600">{s.name}</span>
                <span className="tabular-nums text-slate-900">{formatCents(s.values[current] ?? 0)}</span>
              </p>
            ))}
            {stacked.length > 1 && lines.length === 0 && (
              <p className="mt-1 flex justify-between border-t border-slate-100 pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCents(stackTotal)}</span>
              </p>
            )}
            {drawnLines.map((l) => (
              <p key={l.key} className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-3 shrink-0 rounded" style={{ background: l.color }} />
                <span className="min-w-0 flex-1 truncate text-slate-600">{l.name}</span>
                <span className="tabular-nums text-slate-900">{l.values[current] === null ? "—" : formatCents(l.values[current]!)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      {(stacked.length + drawnLines.length > 1) && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {stacked.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
              {s.icon && <Icon name={s.icon} className="h-3.5 w-3.5 text-slate-500" />}
              {s.name}
            </li>
          ))}
          {drawnLines.map((l) => (
            <li key={l.key} className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: l.color }} />
              {l.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
