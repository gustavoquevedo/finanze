"use client";

import { useState } from "react";
import { ASSET_KINDS, canBeParent, type AssetValuation } from "@/lib/domain/investments";
import type { Asset, Portfolio } from "@/lib/domain/types";
import { inputClass, labelClass } from "./form-styles";
import { FieldError } from "./TransactionForm";

interface Props {
  portfolio?: Portfolio;
  portfolios: Portfolio[];
  assets: Asset[];
  valuations: Map<string, AssetValuation>;
  submitLabel: string;
  onSubmit: (value: Omit<Portfolio, "id">) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function PortfolioForm({ portfolio, portfolios, assets, valuations, submitLabel, onSubmit, onDelete }: Props) {
  const [name, setName] = useState(portfolio?.name ?? "");
  const [parentId, setParentId] = useState(portfolio?.parentId ?? "");
  const [assetIds, setAssetIds] = useState<string[]>(portfolio?.assetIds ?? []);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // A portfolio cannot be inside itself or one of its sub-portfolios.
  const parents = portfolios.filter((p) => !portfolio || canBeParent(portfolio.id, p.id, portfolios));

  const toggle = (id: string) => setAssetIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Indica un nombre.");
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), parentId: parentId || null, assetIds });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="pf-name" className={labelClass}>Nombre</label>
        <input id="pf-name" className={inputClass} placeholder="p. ej. Bogle" value={name} onChange={(e) => (setName(e.target.value), setError(undefined))} />
        <FieldError message={error} />
      </div>
      <div>
        <label htmlFor="pf-parent" className={labelClass}>Dentro de</label>
        <select id="pf-parent" className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Ninguna (cartera principal)</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <fieldset className="space-y-2">
        <legend className={labelClass}>Activos ({assetIds.length})</legend>
        <p className="text-xs text-slate-500">Un activo puede estar en varias carteras.</p>
        {ASSET_KINDS.map(({ value: kind, label }) => {
          const items = assets.filter((a) => a.kind === kind);
          if (items.length === 0) return null;
          return (
            <div key={kind}>
              <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {items.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-3 px-3 py-3">
                      <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={assetIds.includes(a.id)} onChange={() => toggle(a.id)} />
                      <span className="min-w-0 flex-1 truncate">{valuations.get(a.id)?.name ?? a.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {assets.length === 0 && <p className="text-sm text-slate-500">No hay activos todavía.</p>}
      </fieldset>
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50">
        {submitLabel}
      </button>
      {onDelete && (
        <button
          type="button"
          disabled={busy}
          onClick={() => window.confirm("¿Eliminar esta cartera? Sus subcarteras pasan a la cartera superior; los activos no se borran.") && void onDelete()}
          className="w-full rounded-lg border border-rose-300 px-4 py-3 font-medium text-rose-700 disabled:opacity-50"
        >
          Eliminar cartera
        </button>
      )}
    </form>
  );
}
