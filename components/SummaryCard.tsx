import Link from "next/link";
import type { Transaction } from "@/lib/domain/types";
import { Totals } from "./Totals";

/** Tappable summary card that opens the filtered transactions list. */
export function SummaryCard({ title, href, transactions }: { title: string; href: string; transactions: Transaction[] }) {
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
      <Totals transactions={transactions} />
    </Link>
  );
}
