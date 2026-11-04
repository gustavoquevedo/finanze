"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { inputClass, labelClass } from "@/components/form-styles";
import { MoneyInput } from "@/components/MoneyInput";
import { getRepository } from "@/lib/data";
import { addMonths, dayInMonth, todayIso } from "@/lib/domain/dates";
import { valueAsset } from "@/lib/domain/investments";
import { centsToInput, parseEuros } from "@/lib/domain/money";
import type { Asset, AssetSnapshot } from "@/lib/domain/types";
import { formatCents, formatMonth, formatShortDate } from "@/lib/format";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

interface Row {
  value: string;
  /** Funds and ETFs: purchase value changed this month. */
  changed: boolean;
  purchase: string;
  fiscal: string;
}

export default function BalancesPage() {
  return (
    <Suspense>
      <Balances />
    </Suspense>
  );
}

function Balances() {
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const requested = useSearchParams().get("mes");
  // By default, last month: balances are usually noted at the start of the next one.
  const [month, setMonth] = useState(requested && /^\d{4}-\d{2}$/.test(requested) && requested <= thisMonth ? requested : addMonths(thisMonth, -1));
  const date = month === thisMonth ? today : dayInMonth(month, 31);
  const [version, setVersion] = useState(0);
  // Kept here: the form remounts after saving (to reload the stored values).
  const [message, setMessage] = useState<string | null>(null);
  const { data, error } = useData(loadInvestments, [version]);

  const groups: { title: string; hint?: string; filter: (a: Asset) => boolean }[] = [
    { title: "Cuentas del día a día", hint: "Cuentan para el gasto estimado.", filter: (a) => a.kind === "efectivo" && a.dailyUse },
    { title: "Otras cuentas", filter: (a) => a.kind === "efectivo" && !a.dailyUse },
    { title: "Fondos y ETF", filter: (a) => a.kind === "fondo" || a.kind === "etf" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Saldos del mes</h1>
      <p className="text-sm text-slate-600">
        Apunta de una vez el saldo de tus cuentas y el valor de tus fondos a fin de mes. Con ellos se calcula el{" "}
        <Link href="/gasto-estimado" className="font-medium text-emerald-700 underline">gasto estimado</Link> y la evolución de
        tus inversiones.
      </p>
      <div>
        <label htmlFor="bal-month" className={labelClass}>Mes</label>
        <select id="bal-month" className={inputClass} value={month} onChange={(e) => (setMonth(e.target.value), setMessage(null))}>
          {[...new Set([...Array.from({ length: 13 }, (_, i) => addMonths(thisMonth, -i)), month])].map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
              {m === thisMonth ? " (hasta hoy)" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">Se guardan con fecha {formatShortDate(date)} {date.slice(0, 4)}.</p>
      </div>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {data && (
        <BalancesForm
          key={`${date}-${version}`}
          date={date}
          groups={groups.map((g) => ({ ...g, assets: data.assets.filter(g.filter) }))}
          snapshots={data.snapshots}
          onSaved={(text, changed) => {
            setMessage(text);
            if (changed) setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

function BalancesForm({
  date,
  groups,
  snapshots,
  onSaved,
}: {
  date: string;
  groups: { title: string; hint?: string; assets: Asset[] }[];
  snapshots: AssetSnapshot[];
  onSaved: (message: string, changed: boolean) => void;
}) {
  const ctx = { snapshots, properties: [], recurrings: [], date };
  const existing = (id: string) => snapshots.find((s) => s.assetId === id && s.date === date);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      groups.flatMap((g) => g.assets).map((a) => {
        const s = existing(a.id);
        return [
          a.id,
          {
            value: s ? centsToInput(s.value) : "",
            changed: !!s && (s.purchaseValue !== null || s.fiscalCost !== null),
            purchase: s?.purchaseValue != null ? centsToInput(s.purchaseValue) : "",
            fiscal: s?.fiscalCost != null ? centsToInput(s.fiscalCost) : "",
          },
        ];
      }),
    ),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const all = groups.flatMap((g) => g.assets);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const problems: string[] = [];
    const toSave: Omit<AssetSnapshot, "id">[] = [];
    for (const a of all) {
      const r = rows[a.id];
      if (!r.value.trim()) continue;
      const value = parseEuros(r.value);
      const purchase = r.changed && r.purchase.trim() ? parseEuros(r.purchase) : null;
      const fiscal = r.changed && r.fiscal.trim() ? parseEuros(r.fiscal) : null;
      if (value === null || (r.changed && r.purchase.trim() && purchase === null) || (r.changed && r.fiscal.trim() && fiscal === null)) {
        problems.push(a.name);
        continue;
      }
      const s = existing(a.id);
      if (s && s.value === value && s.purchaseValue === purchase && s.fiscalCost === fiscal) continue;
      toSave.push({ assetId: a.id, date, value, purchaseValue: purchase, fiscalCost: fiscal });
    }
    setErrors(problems);
    if (problems.length) return;
    setBusy(true);
    try {
      for (const s of toSave) await getRepository().saveAssetSnapshot(s);
      onSaved(
        toSave.length === 0 ? "No había cambios." : toSave.length === 1 ? "Guardado 1 valor." : `Guardados ${toSave.length} valores.`,
        toSave.length > 0,
      );
    } finally {
      setBusy(false);
    }
  }

  if (all.length === 0) {
    return (
      <p className="text-center text-slate-500">
        No hay cuentas ni fondos. Créalos en <Link href="/inversiones/activos" className="font-medium text-emerald-700 underline">Activos</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      {groups.map((g) =>
        g.assets.length === 0 ? null : (
          <section key={g.title} className="space-y-2">
            <h2 className="text-sm font-medium text-slate-500">
              {g.title}
              {g.hint && <span className="font-normal"> · {g.hint}</span>}
            </h2>
            <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
              {g.assets.map((a) => {
                const v = valueAsset(a, ctx);
                const r = rows[a.id];
                const fund = a.kind === "fondo" || a.kind === "etf";
                const invalid = errors.includes(a.name);
                return (
                  <li key={a.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor={`bal-${a.id}`} className="min-w-0 truncate font-medium">{a.name}</label>
                      <span className="shrink-0 text-xs text-slate-500">
                        {v.value !== null && v.valueDate ? `${formatCents(v.value)} · ${formatShortDate(v.valueDate)}` : "sin valores"}
                      </span>
                    </div>
                    <MoneyInput id={`bal-${a.id}`} value={r.value} onChange={(value) => set(a.id, { value })} placeholder="Valor a esa fecha" invalid={invalid} />
                    {fund && (
                      <>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={r.changed} onChange={(e) => set(a.id, { changed: e.target.checked })} />
                          He aportado o retirado este mes
                        </label>
                        {r.changed && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="mb-1 block text-xs text-slate-500">Valor de compra</span>
                              <MoneyInput id={`bal-p-${a.id}`} value={r.purchase} onChange={(purchase) => set(a.id, { purchase })} placeholder={v.purchaseValue !== null ? centsToInput(v.purchaseValue) : "0"} />
                            </div>
                            <div>
                              <span className="mb-1 block text-xs text-slate-500">Coste fiscal</span>
                              <MoneyInput id={`bal-f-${a.id}`} value={r.fiscal} onChange={(fiscal) => set(a.id, { fiscal })} placeholder="Opcional" />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {invalid && <p className="text-sm text-rose-700">Revisa los importes de este activo.</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}
      <p className="text-xs text-slate-500">Los inmuebles se valoran desde su ficha (tasaciones), no aquí.</p>
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50">
        {busy ? "Guardando…" : "Guardar saldos"}
      </button>
    </form>
  );
}
