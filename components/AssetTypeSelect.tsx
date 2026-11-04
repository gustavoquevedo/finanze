import Link from "next/link";
import type { AssetType } from "@/lib/domain/types";
import { labelClass } from "./form-styles";
import { OptionPicker } from "./OptionPicker";

/** «Tipo de activo» picker with icons and «Sin tipo». */
export function AssetTypeSelect({ id, types, value, onChange }: { id: string; types: AssetType[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>Tipo de activo</label>
      <OptionPicker
        id={id}
        title="Tipo de activo"
        groups={[{ options: types.map((t) => ({ id: t.id, name: t.name, icon: t.icon })) }]}
        value={value}
        onChange={onChange}
        noneLabel="Sin tipo"
      />
      <p className="mt-1 text-xs text-slate-500">
        Para los gráficos de reparto.{" "}
        <Link href="/inversiones/tipos" className="font-medium text-emerald-700 underline">Gestionar tipos</Link>
      </p>
    </div>
  );
}
