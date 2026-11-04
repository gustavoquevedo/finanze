import Link from "next/link";
import type { AssetType } from "@/lib/domain/types";
import { inputClass, labelClass } from "./form-styles";

/** «Tipo de activo» select with «Sin tipo». */
export function AssetTypeSelect({ id, types, value, onChange }: { id: string; types: AssetType[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>Tipo de activo</label>
      <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin tipo</option>
        {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <p className="mt-1 text-xs text-slate-500">
        Para los gráficos de reparto.{" "}
        <Link href="/inversiones/tipos" className="font-medium text-emerald-700 underline">Gestionar tipos</Link>
      </p>
    </div>
  );
}
