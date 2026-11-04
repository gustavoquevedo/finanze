"use client";

import { useState } from "react";
import { formatCents } from "@/lib/format";

/**
 * Categorical palette (validated: adjacent CVD ΔE ≥ 9.1, normal-vision ≥ 19.6 on white).
 * Assigned in fixed order by the entity's position, never by its value.
 */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const OTHER_COLOR = "#a3a3a3";
const MAX_SLICES = SERIES_COLORS.length;

export interface Slice {
  id: string;
  name: string;
  value: number;
}

interface Arc extends Slice {
  color: string;
  share: number;
  start: number;
  end: number;
}

/** Folds anything past the 8th slice (in given order) into "Otros". */
function toArcs(slices: Slice[]): Arc[] {
  const positive = slices.filter((s) => s.value > 0);
  const main = positive.slice(0, positive.length > MAX_SLICES ? MAX_SLICES - 1 : MAX_SLICES);
  const rest = positive.slice(main.length);
  const items = rest.length ? [...main, { id: "__otros", name: "Otros", value: rest.reduce((s, x) => s + x.value, 0) }] : main;
  const total = items.reduce((s, x) => s + x.value, 0);
  let angle = 0;
  return items.map((s, i) => {
    const share = total ? s.value / total : 0;
    const arc = { ...s, color: s.id === "__otros" ? OTHER_COLOR : SERIES_COLORS[i], share, start: angle, end: angle + share * 2 * Math.PI };
    angle = arc.end;
    return arc;
  });
}

function arcPath(cx: number, cy: number, r: number, inner: number, start: number, end: number): string {
  // A full circle can't be one arc: split it in two halves.
  if (end - start >= 2 * Math.PI - 1e-6) {
    const mid = start + Math.PI;
    return arcPath(cx, cy, r, inner, start, mid) + " " + arcPath(cx, cy, r, inner, mid, end);
  }
  const p = (radius: number, a: number) => `${cx + radius * Math.sin(a)} ${cy - radius * Math.cos(a)}`;
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${p(r, start)} A ${r} ${r} 0 ${large} 1 ${p(r, end)} L ${p(inner, end)} A ${inner} ${inner} 0 ${large} 0 ${p(inner, start)} Z`;
}

/** Donut with legend. Tap a slice or legend row to see its value in the centre. */
export function Donut({ slices, totalLabel = "Total" }: { slices: Slice[]; totalLabel?: string }) {
  const arcs = toArcs(slices);
  const [selected, setSelected] = useState<string | null>(null);
  const current = arcs.find((a) => a.id === selected) ?? null;
  const total = arcs.reduce((s, a) => s + a.value, 0);
  const size = 200;
  const pct = (x: number) => `${(x * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;

  if (arcs.length === 0) return <p className="text-sm text-slate-500">Sin valores para mostrar.</p>;

  return (
    <div className="space-y-3">
      <div className="relative mx-auto w-[200px]">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Pesos de la cartera">
          {arcs.map((a) => (
            <path
              key={a.id}
              d={arcPath(100, 100, 96, 62, a.start, a.end)}
              fill={a.color}
              // 2px surface gap between slices.
              stroke="#ffffff"
              strokeWidth={2}
              opacity={current && current.id !== a.id ? 0.35 : 1}
              onClick={() => setSelected(selected === a.id ? null : a.id)}
              className="cursor-pointer"
            >
              <title>{`${a.name}: ${formatCents(a.value)} (${pct(a.share)})`}</title>
            </path>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          <span className="line-clamp-2 text-xs text-slate-500">{current ? current.name : totalLabel}</span>
          <span className="text-sm font-semibold tabular-nums">{formatCents(current ? current.value : total)}</span>
          {current && <span className="text-xs text-slate-500">{pct(current.share)}</span>}
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {arcs.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setSelected(selected === a.id ? null : a.id)}
              className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left ${selected === a.id ? "bg-slate-100" : ""}`}
            >
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: a.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-700">{a.name}</span>
              <span className="shrink-0 tabular-nums text-slate-900">{pct(a.share)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
