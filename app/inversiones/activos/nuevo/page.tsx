"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AssetTypeSelect } from "@/components/AssetTypeSelect";
import { BackLink } from "@/components/BackLink";
import { inputClass, labelClass } from "@/components/form-styles";
import { FieldError } from "@/components/TransactionForm";
import { getRepository } from "@/lib/data";
import { ASSET_KINDS } from "@/lib/domain/investments";
import type { AssetKind } from "@/lib/domain/types";
import { useData } from "@/lib/use-data";

export default function NewAssetPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AssetKind>("fondo");
  const [assetTypeId, setAssetTypeId] = useState("");
  const types = useData((repo) => repo.listAssetTypes());
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Indica un nombre.");
    const asset = await getRepository().createAsset({ name, kind, propertyId: null, assetTypeId: assetTypeId || null, dailyUse: true, active: true });
    // Straight to the asset, to add its first value.
    router.replace(`/inversiones/activos/editar?id=${encodeURIComponent(asset.id)}`);
  }

  return (
    <div className="space-y-4">
      <BackLink fallback="/inversiones/activos" />
      <h1 className="text-2xl font-bold">Nuevo activo</h1>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="as-name" className={labelClass}>Nombre</label>
          <input
            id="as-name"
            className={inputClass}
            placeholder="p. ej. Fondo indexado RV global"
            value={name}
            onChange={(e) => (setName(e.target.value), setError(undefined))}
          />
          <FieldError message={error} />
        </div>
        <div>
          <label htmlFor="as-kind" className={labelClass}>Producto</label>
          <select id="as-kind" className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
            {ASSET_KINDS.filter((k) => k.value !== "inmobiliario").map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Los inmuebles se crean solos desde Pisos.</p>
        </div>
        <AssetTypeSelect id="as-type" types={types.data ?? []} value={assetTypeId} onChange={setAssetTypeId} />
        <button type="submit" className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white">Crear activo</button>
      </form>
    </div>
  );
}
