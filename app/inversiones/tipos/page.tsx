"use client";

import { useState } from "react";
import { SERIES_COLORS } from "@/components/Donut";
import { inputClass } from "@/components/form-styles";
import { FieldError } from "@/components/TransactionForm";
import { getRepository } from "@/lib/data";
import type { AssetType } from "@/lib/domain/types";
import { formatCents } from "@/lib/format";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

const message = (e: unknown) =>
  e instanceof Error && /Duplicate/.test(e.message) ? "Ya hay un tipo con ese nombre." : e instanceof Error ? e.message : String(e);

export default function AssetTypesPage() {
  const [version, setVersion] = useState(0);
  const { data, error } = useData(
    async (repo) => {
      const inv = await loadInvestments(repo);
      const types = await repo.listAssetTypes();
      return types.map((t, i) => {
        const assets = inv.assets.filter((a) => a.assetTypeId === t.id);
        const value = assets.reduce((s, a) => s + (inv.valuations.get(a.id)?.value ?? 0), 0);
        return { type: t, colorIndex: i, count: assets.length, value };
      });
    },
    [version],
  );
  const reload = () => setVersion((v) => v + 1);

  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string>();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setAddError("Indica un nombre.");
    try {
      await getRepository().createAssetType({ name });
      setName("");
      reload();
    } catch (err) {
      setAddError(message(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tipos de activo</h1>
      <p className="text-sm text-slate-600">
        Clasifica tus activos (renta variable, renta fija, liquidez…) para ver el reparto en Inversiones y en cada cartera. Cada
        activo tiene un tipo o ninguno («Sin tipo»); se asigna en la ficha del activo.
      </p>
      <form onSubmit={add} noValidate className="flex gap-2">
        <div className="min-w-0 flex-1">
          <input
            aria-label="Nuevo tipo"
            className={inputClass}
            placeholder="p. ej. Renta variable"
            value={name}
            onChange={(e) => (setName(e.target.value), setAddError(undefined))}
          />
          <FieldError message={addError} />
        </div>
        <button type="submit" className="h-[50px] shrink-0 rounded-lg bg-emerald-700 px-4 font-medium text-white">Añadir</button>
      </form>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data?.length === 0 && <p className="text-center text-slate-500">Todavía no hay tipos.</p>}
      {data && data.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
          {data.map((row) => (
            <TypeRow key={row.type.id} {...row} onChanged={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TypeRow({ type, colorIndex, count, value, onChanged }: { type: AssetType; colorIndex: number; count: number; value: number; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);
  const [error, setError] = useState<string>();
  const color = colorIndex < SERIES_COLORS.length ? SERIES_COLORS[colorIndex] : "#d4d4d4";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Indica un nombre.");
    try {
      await getRepository().updateAssetType(type.id, { name });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(message(err));
    }
  }

  async function remove() {
    const text =
      count === 0
        ? `¿Eliminar el tipo «${type.name}»?`
        : `¿Eliminar el tipo «${type.name}»? ${count === 1 ? "Su activo pasará" : `Sus ${count} activos pasarán`} a «Sin tipo».`;
    if (!window.confirm(text)) return;
    await getRepository().deleteAssetType(type.id);
    onChanged();
  }

  if (editing) {
    return (
      <li className="space-y-2 px-4 py-3">
        <form onSubmit={save} noValidate className="flex gap-2">
          <input aria-label="Nombre del tipo" className={inputClass} value={name} onChange={(e) => (setName(e.target.value), setError(undefined))} autoFocus />
          <button type="submit" className="shrink-0 rounded-lg bg-emerald-700 px-3 font-medium text-white">Guardar</button>
        </form>
        <FieldError message={error} />
        <div className="flex justify-between text-sm">
          <button type="button" onClick={() => (setEditing(false), setName(type.name))} className="text-slate-600">Cancelar</button>
          <button type="button" onClick={() => void remove()} className="font-medium text-rose-700">Eliminar tipo</button>
        </div>
      </li>
    );
  }
  return (
    <li>
      <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: color }} />
        <span className="min-w-0 flex-1 truncate font-medium">{type.name}</span>
        <span className="shrink-0 text-right text-xs text-slate-500">
          <span className="block tabular-nums text-sm text-slate-900">{formatCents(value)}</span>
          {count === 0 ? "Sin activos" : count === 1 ? "1 activo" : `${count} activos`}
        </span>
      </button>
    </li>
  );
}
