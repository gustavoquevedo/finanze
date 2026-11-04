import { formatCents } from "@/lib/format";

const pct = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`;

/** Signed gain with its percentage over `base`. */
export function Gain({ cents, base, showPct = true }: { cents: number | null; base?: number | null; showPct?: boolean }) {
  if (cents === null) return <span className="text-slate-400">—</span>;
  const color = cents > 0 ? "text-emerald-700" : cents < 0 ? "text-rose-700" : "text-slate-600";
  return (
    <span className={`tabular-nums ${color}`}>
      {cents > 0 ? "+" : ""}
      {formatCents(cents)}
      {showPct && base ? <span className="ml-1 text-xs">({pct(cents / base)})</span> : null}
    </span>
  );
}

export { pct as formatPct };
