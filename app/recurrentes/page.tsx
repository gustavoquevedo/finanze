"use client";

import Link from "next/link";
import { Amount } from "@/components/Amount";
import { todayIso } from "@/lib/domain/dates";
import { mortgageStatus } from "@/lib/domain/mortgage";
import { nextOccurrence, planOf } from "@/lib/domain/recurring";
import { describeSchedule, formatCents, formatShortDate } from "@/lib/format";
import { useData } from "@/lib/use-data";

export default function RecurringsPage() {
  const { data, error } = useData(async (repo) => {
    const [recurrings, properties] = await Promise.all([repo.listRecurrings(), repo.listProperties()]);
    const today = todayIso();
    const names = new Map(properties.map((p) => [p.id, p.name]));
    return recurrings
      .map((r) => {
        const after = r.generatedUntil && r.generatedUntil > today ? r.generatedUntil : today;
        const status = r.mortgage ? mortgageStatus(planOf(r), r.mortgage.principal, today, r.mortgage.adjustments) : null;
        return {
          r,
          status,
          next: status ? (status.next?.date ?? null) : nextOccurrence(r, after),
          place: r.propertyId ? names.get(r.propertyId) : "Personal",
        };
      })
      .sort((a, b) => (a.next ?? "9999").localeCompare(b.next ?? "9999"));
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Recurrentes</h1>
      <p className="text-sm text-slate-600">
        Se añaden solos el día previsto como movimientos <span className="font-medium text-amber-800">⟳ automáticos</span>, que cuentan en los totales hasta que los confirmes.
      </p>
      <Link
        href="/recurrentes/nuevo"
        aria-label="Nuevo recurrente"
        className="fixed right-4 bottom-20 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl text-white shadow-lg"
      >
        +
      </Link>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data?.length === 0 && <p className="text-center text-slate-500">No hay recurrentes. Pulsa + para crear uno.</p>}
      {data && data.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
          {data.map(({ r, next, place, status }) => (
            <li key={r.id}>
              <Link
                href={`/recurrentes/editar?id=${encodeURIComponent(r.id)}`}
                className={`flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50 ${next ? "" : "opacity-60"}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.concept}</p>
                  <p className="truncate text-xs text-slate-500">
                    {status ? (
                      <>
                        🏦 Hipoteca · {status.last ? `${status.last.number}/${r.mortgage!.installments}` : `0/${r.mortgage!.installments}`} ·
                        pendiente {formatCents(status.balance)}
                      </>
                    ) : (
                      describeSchedule(r)
                    )}{" "}
                    · {place}
                  </p>
                  <p className="text-xs text-slate-500">
                    {next ? `Próximo: ${formatShortDate(next)} ${next.slice(0, 4)}` : "Finalizado"}
                  </p>
                </div>
                <span className="shrink-0 text-sm">
                  <Amount cents={status?.next?.payment ?? r.amount} type={r.type} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
