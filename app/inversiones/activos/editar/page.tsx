"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AssetTypeSelect } from "@/components/AssetTypeSelect";
import { BackLink } from "@/components/BackLink";
import { inputClass, labelClass } from "@/components/form-styles";
import { Gain } from "@/components/Gain";
import { MoneyInput } from "@/components/MoneyInput";
import { FieldError } from "@/components/TransactionForm";
import { getRepository } from "@/lib/data";
import { todayIso } from "@/lib/domain/dates";
import { ASSET_KINDS } from "@/lib/domain/investments";
import { centsToInput, parseEuros } from "@/lib/domain/money";
import type { Asset, AssetKind, AssetSnapshot, AssetType } from "@/lib/domain/types";
import { formatCents, formatShortDate } from "@/lib/format";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

export default function EditAssetPage() {
  return (
    <Suspense>
      <EditAsset />
    </Suspense>
  );
}

const dateLabel = (d: string) => `${formatShortDate(d)} ${d.slice(0, 4)}`;

function EditAsset() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const [version, setVersion] = useState(0);
  const { data, error } = useData(
    async (repo) => {
      const inv = await loadInvestments(repo);
      return {
        ...inv,
        types: await repo.listAssetTypes(),
        asset: inv.assets.find((a) => a.id === id) ?? null,
        own: inv.snapshots.filter((s) => s.assetId === id).reverse(),
        inPortfolios: inv.portfolios.filter((p) => p.assetIds.includes(id)),
      };
    },
    [id, version],
  );
  const asset = data?.asset;
  const valuation = asset ? data.valuations.get(asset.id) : undefined;
  const reload = () => setVersion((v) => v + 1);

  return (
    <div className="space-y-5">
      <BackLink fallback="/inversiones/activos" />
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !asset && <p className="text-slate-500">Este activo no existe o se ha eliminado.</p>}
      {data && asset && valuation && (
        <>
          <h1 className="text-2xl font-bold">{valuation.name}</h1>

          <section className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-slate-500">
                Valor{valuation.valueDate ? ` a ${dateLabel(valuation.valueDate)}` : ""}
              </span>
              <span className="text-lg font-semibold tabular-nums">{valuation.value !== null ? formatCents(valuation.value) : "—"}</span>
            </div>
            {asset.kind !== "efectivo" && (
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <div><dt className="text-xs text-slate-500">Valor de compra</dt><dd className="tabular-nums">{valuation.purchaseValue !== null ? formatCents(valuation.purchaseValue) : "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Plusvalía</dt><dd><Gain cents={valuation.gain} base={valuation.purchaseValue} /></dd></div>
                <div><dt className="text-xs text-slate-500">Coste fiscal</dt><dd className="tabular-nums">{valuation.fiscalCost !== null ? formatCents(valuation.fiscalCost) : "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">Plusvalía fiscal</dt><dd><Gain cents={valuation.fiscalGain} base={valuation.fiscalCost} /></dd></div>
                {valuation.debt > 0 && (
                  <div className="col-span-2"><dt className="text-xs text-slate-500">Hipoteca pendiente</dt><dd className="tabular-nums">−{formatCents(valuation.debt)} · neto {formatCents((valuation.value ?? 0) - valuation.debt)}</dd></div>
                )}
              </dl>
            )}
            {data.inPortfolios.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-1 text-xs">
                <span className="text-slate-500">En carteras:</span>
                {data.inPortfolios.map((p) => (
                  <Link key={p.id} href={`/inversiones/carteras/ver?id=${encodeURIComponent(p.id)}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                    {p.name}
                  </Link>
                ))}
              </p>
            )}
          </section>

          <SnapshotEditor key={version} asset={asset} snapshots={data.own} onSaved={reload} />

          {asset.propertyId ? (
            <section className="space-y-3">
            <AssetTypeSelect
              id="as-type"
              types={data.types}
              value={asset.assetTypeId ?? ""}
              onChange={async (v) => {
                await getRepository().updateAsset(asset.id, { assetTypeId: v || null });
                reload();
              }}
            />
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              Inmueble de Pisos: el nombre, el valor de compra y el coste fiscal (precio + gastos de compra) vienen de su ficha.{" "}
              <Link href={`/pisos/editar?id=${encodeURIComponent(asset.propertyId)}`} className="font-medium underline">Editar piso</Link>
            </p>
            </section>
          ) : (
            <AssetDetails
              asset={asset}
              types={data.types}
              onSaved={reload}
              onDelete={async () => {
                await getRepository().deleteAsset(asset.id);
                router.replace("/inversiones/activos");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function SnapshotEditor({ asset, snapshots, onSaved }: { asset: Asset; snapshots: AssetSnapshot[]; onSaved: () => void }) {
  // Cash has no gains and real estate takes its costs from the flat.
  const withCosts = asset.kind === "fondo" || asset.kind === "etf";
  const [date, setDate] = useState(todayIso());
  const [value, setValue] = useState("");
  const [purchase, setPurchase] = useState("");
  const [fiscal, setFiscal] = useState("");
  const [error, setError] = useState<string>();
  const editing = snapshots.find((s) => s.date === date);

  function load(s: AssetSnapshot) {
    setDate(s.date);
    setValue(centsToInput(s.value));
    setPurchase(s.purchaseValue !== null ? centsToInput(s.purchaseValue) : "");
    setFiscal(s.fiscalCost !== null ? centsToInput(s.fiscalCost) : "");
    setError(undefined);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = parseEuros(value);
    const p = purchase.trim() ? parseEuros(purchase) : null;
    const f = fiscal.trim() ? parseEuros(fiscal) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Indica la fecha.");
    if (v === null) return setError("Indica el valor. Ejemplo: 102.219,00 o 102,219.00");
    if ((purchase.trim() && p === null) || (fiscal.trim() && f === null)) return setError("Importe no válido.");
    await getRepository().saveAssetSnapshot({ assetId: asset.id, date, value: v, purchaseValue: p, fiscalCost: f });
    onSaved();
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Valores (snapshots)</h2>
      <form onSubmit={save} noValidate className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sn-date" className={labelClass}>Fecha</label>
            <input id="sn-date" type="date" className={inputClass} value={date} onChange={(e) => (setDate(e.target.value), setError(undefined))} />
          </div>
          <div>
            <label htmlFor="sn-value" className={labelClass}>Valor (€)</label>
            <MoneyInput id="sn-value" value={value} onChange={(v) => (setValue(v), setError(undefined))} />
          </div>
        </div>
        {withCosts && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sn-purchase" className={labelClass}>Valor de compra</label>
                <MoneyInput id="sn-purchase" value={purchase} onChange={setPurchase} placeholder="Igual que antes" />
              </div>
              <div>
                <label htmlFor="sn-fiscal" className={labelClass}>Coste fiscal</label>
                <MoneyInput id="sn-fiscal" value={fiscal} onChange={setFiscal} placeholder="Igual que antes" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Rellénalos solo si han cambiado (aportaciones, ventas o traspasos). Coste fiscal: el valor de adquisición original que
              se mantiene en los traspasos entre fondos; si no lo indicas, es igual al valor de compra.
            </p>
          </>
        )}
        <FieldError message={error} />
        <button type="submit" className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white">
          {editing ? "Guardar cambios de esa fecha" : "Añadir valor"}
        </button>
      </form>

      {snapshots.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay valores.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
          {snapshots.map((s) => (
            <li key={s.id} className="flex items-center gap-2 pr-2">
              <button type="button" onClick={() => load(s)} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2.5 pl-4 text-left text-sm active:bg-slate-50">
                <span className="shrink-0">{dateLabel(s.date)}</span>
                <span className="min-w-0 text-right">
                  <span className="block font-medium tabular-nums">{formatCents(s.value)}</span>
                  {(s.purchaseValue !== null || s.fiscalCost !== null) && (
                    <span className="block truncate text-xs text-slate-500">
                      {s.purchaseValue !== null && `compra ${formatCents(s.purchaseValue)}`}
                      {s.purchaseValue !== null && s.fiscalCost !== null && " · "}
                      {s.fiscalCost !== null && `fiscal ${formatCents(s.fiscalCost)}`}
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("¿Eliminar este valor?")) return;
                  await getRepository().deleteAssetSnapshot(s.id);
                  onSaved();
                }}
                className="shrink-0 px-2 text-rose-700"
                aria-label={`Eliminar valor del ${s.date}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AssetDetails({ asset, types, onSaved, onDelete }: { asset: Asset; types: AssetType[]; onSaved: () => void; onDelete: () => Promise<void> }) {
  const [name, setName] = useState(asset.name);
  const [kind, setKind] = useState<AssetKind>(asset.kind);
  const [assetTypeId, setAssetTypeId] = useState(asset.assetTypeId ?? "");
  const [error, setError] = useState<string>();
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Datos del activo</h2>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Indica un nombre.");
          await getRepository().updateAsset(asset.id, { name: name.trim(), kind, assetTypeId: assetTypeId || null });
          onSaved();
        }}
        className="space-y-3"
      >
        <div>
          <label htmlFor="as-name" className={labelClass}>Nombre</label>
          <input id="as-name" className={inputClass} value={name} onChange={(e) => (setName(e.target.value), setError(undefined))} />
          <FieldError message={error} />
        </div>
        <div>
          <label htmlFor="as-kind" className={labelClass}>Producto</label>
          <select id="as-kind" className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
            {ASSET_KINDS.filter((k) => k.value !== "inmobiliario").map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <AssetTypeSelect id="as-type" types={types} value={assetTypeId} onChange={setAssetTypeId} />
        <button type="submit" className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700">
          Guardar datos
        </button>
        <button
          type="button"
          onClick={() => window.confirm("¿Eliminar este activo y todos sus valores? Se quitará de sus carteras.") && void onDelete()}
          className="w-full rounded-lg border border-rose-300 px-4 py-2.5 font-medium text-rose-700"
        >
          Eliminar activo
        </button>
      </form>
    </section>
  );
}
