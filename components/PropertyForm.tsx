"use client";

import { useState } from "react";
import { parseEuros } from "@/lib/domain/money";
import { validatePropertyForm, type PropertyFormErrors, type PropertyFormValues } from "@/lib/domain/property-form";
import type { Property } from "@/lib/domain/types";
import { formatCents } from "@/lib/format";
import { inputClass, labelClass } from "./form-styles";
import { FieldError } from "./TransactionForm";

interface Props {
  initial: PropertyFormValues;
  submitLabel: string;
  onSubmit: (value: Omit<Property, "id">) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Shown in the delete confirmation. */
  deleteWarning?: string;
}

export function PropertyForm({ initial, submitLabel, onSubmit, onDelete, deleteWarning }: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<PropertyFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (patch: Partial<PropertyFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key as keyof PropertyFormValues];
      return next;
    });
  };

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setSaveError(null);
    try {
      await action();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validatePropertyForm(values);
    if (!result.ok) return setErrors(result.errors);
    void run(() => onSubmit(result.value));
  }

  const field = (key: keyof PropertyFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div>
      <label htmlFor={`pr-${key}`} className={labelClass}>{label}</label>
      <input
        id={`pr-${key}`}
        className={inputClass}
        value={values[key] as string}
        onChange={(e) => set({ [key]: e.target.value })}
        aria-invalid={!!errors[key]}
        {...props}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <FieldError message={errors[key]} />
    </div>
  );

  // Live preview of the depreciation base.
  const price = parseEuros(values.acquisitionPrice) ?? 0;
  const costs = parseEuros(values.purchaseCosts) ?? 0;
  const cadastral = parseEuros(values.cadastralValue);
  const pct = Number(values.constructionPercentage.replace(",", "."));
  const greater = Math.max(price + costs, cadastral ?? 0);
  const base = Number.isFinite(pct) ? Math.round((greater * pct) / 100) : 0;
  const money = { inputMode: "decimal" as const, autoComplete: "off", placeholder: "0" };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {field("name", "Nombre", { placeholder: "p. ej. Piso Centro" })}
      {field("address", "Dirección", { placeholder: "Opcional" })}
      <div className="grid grid-cols-2 gap-3">
        {field("purchaseDate", "Fecha de compra", { type: "date" })}
        {field("acquisitionPrice", "Precio de compra (€)", money)}
      </div>
      {field("purchaseCosts", "Gastos e impuestos de compra (€)", money, "Notaría, registro, gestoría, ITP o IVA y AJD.")}
      <div className="grid grid-cols-2 gap-3">
        {field("cadastralValue", "Valor catastral (€)", { ...money, placeholder: "Opcional" }, "Total, en el recibo del IBI.")}
        {field(
          "constructionPercentage",
          "% construcción",
          { inputMode: "decimal", placeholder: "60" },
          "Valor catastral de la construcción ÷ valor catastral total.",
        )}
      </div>

      {base > 0 && (
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <p>
            Base de amortización: <span className="font-medium">{formatCents(base)}</span>
          </p>
          <p className="text-xs text-slate-500">
            {pct}% del mayor entre coste de adquisición ({formatCents(price + costs)})
            {cadastral !== null && <> y valor catastral ({formatCents(cadastral)})</>}. Amortización anual orientativa (3%):{" "}
            {formatCents(Math.round(base * 0.03))}.
          </p>
        </div>
      )}

      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-emerald-700"
          checked={values.active}
          onChange={(e) => set({ active: e.target.checked })}
        />
        <span className="font-medium">Activo (alquilado o disponible)</span>
      </label>

      {saveError && <p className="text-sm text-rose-700">No se pudo guardar: {saveError}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50">
        {submitLabel}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => window.confirm(deleteWarning ?? "¿Eliminar este piso?") && void run(onDelete)}
          disabled={busy}
          className="w-full rounded-lg border border-rose-300 px-4 py-3 font-medium text-rose-700 disabled:opacity-50"
        >
          Eliminar piso
        </button>
      )}
    </form>
  );
}
