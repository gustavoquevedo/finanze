import Link from "next/link";
import type { Totals as TotalsValue } from "@/lib/domain/totals";
import { Totals } from "./Totals";

/** Tappable summary card that opens the filtered transactions list. */
export function SummaryCard({ title, href, totals }: { title: string; href: string; totals: TotalsValue }) {
  return (
    <Link
      href={href}
      aria-label={`Ver movimientos: ${title}`}
      className="block rounded-xl bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <h3 className="mb-2 flex items-center justify-between font-semibold">
        {title}
        <span aria-hidden className="text-slate-400">›</span>
      </h3>
      <Totals totals={totals} />
    </Link>
  );
}
