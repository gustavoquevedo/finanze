"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { MortgageRows } from "@/components/MortgageTable";
import { todayIso } from "@/lib/domain/dates";
import { planOf } from "@/lib/domain/recurring";
import { formatCents } from "@/lib/format";
import { useData } from "@/lib/use-data";

export default function MortgageSchedulePage() {
  return (
    <Suspense>
      <MortgageSchedule />
    </Suspense>
  );
}

const METHOD = { mensual: "mensual (TIN ÷ 12)", dias365: "por días, base 365", dias360: "por días, base 360" } as const;

function MortgageSchedule() {
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useData(async (repo) => (await repo.listRecurrings()).find((r) => r.id === id) ?? null, [id]);
  const r = data?.mortgage ? data : null;
  const plan = r ? planOf(r) : [];
  const today = todayIso();
  const sum = (key: "payment" | "interest" | "principal") => plan.reduce((s, q) => s + q[key], 0);

  function downloadCsv() {
    if (!r) return;
    // Spanish spreadsheet format: semicolon separator and decimal comma.
    const n = (c: number) => (c / 100).toFixed(2).replace(".", ",");
    const lines = [
      "Cuota nº;Fecha;Cuota;Intereses;Amortización;Capital pendiente",
      ...plan.map((q) => [q.number, q.date, n(q.payment), n(q.interest), n(q.principal), n(q.balance)].join(";")),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cuadro-${r.concept.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <BackLink fallback="/recurrentes" />
      <h1 className="text-2xl font-bold">Cuadro de amortización</h1>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data !== undefined && data !== null && !r && <p className="text-slate-500">Este recurrente no es una hipoteca.</p>}
      {r && r.mortgage && (
        <>
          <section className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <h2 className="font-semibold">{r.concept}</h2>
            <p className="text-slate-600">
              {formatCents(r.mortgage.principal)} al {String(r.mortgage.annualRate).replace(".", ",")}% TIN · {r.mortgage.installments}{" "}
              cuotas · intereses {METHOD[r.mortgage.interestMethod]}
            </p>
            {r.mortgage.adjustments.length > 0 && (
              <p className="text-xs text-sky-800">Incluye {r.mortgage.adjustments.length} ajuste(s) del banco.</p>
            )}
            <dl className="mt-3 grid grid-cols-3 gap-2">
              <div><dt className="text-xs text-slate-500">Total pagado</dt><dd className="font-medium tabular-nums">{formatCents(sum("payment"))}</dd></div>
              <div><dt className="text-xs text-slate-500">Intereses</dt><dd className="font-medium tabular-nums">{formatCents(sum("interest"))}</dd></div>
              <div><dt className="text-xs text-slate-500">Capital</dt><dd className="font-medium tabular-nums">{formatCents(sum("principal"))}</dd></div>
            </dl>
            <button type="button" onClick={downloadCsv} className="mt-3 w-full rounded-lg border border-emerald-700 px-4 py-2 font-medium text-emerald-700">
              Descargar CSV (para comparar en Excel)
            </button>
          </section>
          <MortgageRows rows={plan} today={today} />
          <p className="text-xs text-slate-500">Importes en €. En gris, cuotas ya pagadas; en azul, recalculadas por un ajuste.</p>
        </>
      )}
    </div>
  );
}
