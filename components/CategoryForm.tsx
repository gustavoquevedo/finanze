"use client";

import { useState } from "react";
import { validateCategoryForm, type CategoryFormValues } from "@/lib/domain/category-form";
import type { Category, CategoryScope, TransactionType } from "@/lib/domain/types";
import { inputClass, labelClass } from "./form-styles";
import { IconPicker } from "./IconPicker";
import { FieldError } from "./TransactionForm";

interface Props {
  initial: CategoryFormValues;
  existing: Category[];
  editingId?: string;
  /** Uses of the category; if any, type and scope are locked and it can't be deleted. */
  usage?: { transactions: number; recurrings: number };
  submitLabel: string;
  onSubmit: (value: Omit<Category, "id">) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 ${value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function CategoryForm({ initial, existing, editingId, usage, submitLabel, onSubmit, onDelete }: Props) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const used = usage ? usage.transactions + usage.recurrings > 0 : false;
  const set = (patch: Partial<CategoryFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setError(undefined);
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
    const result = validateCategoryForm(values, existing, editingId);
    if (!result.ok) return setError(result.errors.name);
    void run(() => onSubmit(result.value));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="cat-name" className={labelClass}>Nombre</label>
        <input
          id="cat-name"
          className={inputClass}
          placeholder="p. ej. Muebles y electrodomésticos"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          aria-invalid={!!error}
        />
        <FieldError message={error} />
      </div>

      <div>
        <label htmlFor="cat-icon" className={labelClass}>Icono</label>
        <IconPicker id="cat-icon" value={values.icon} onChange={(icon) => set({ icon })} />
      </div>

      <div>
        <span className={labelClass}>Ámbito</span>
        <Segmented<CategoryScope>
          name="Ámbito"
          value={values.scope}
          disabled={used}
          options={[{ value: "piso", label: "Pisos" }, { value: "personal", label: "Personal" }]}
          onChange={(scope) => set({ scope })}
        />
      </div>

      <div>
        <span className={labelClass}>Tipo</span>
        <Segmented<TransactionType>
          name="Tipo"
          value={values.type}
          disabled={used}
          options={[{ value: "ingreso", label: "Ingreso" }, { value: "gasto", label: "Gasto" }]}
          onChange={(type) => set({ type })}
        />
      </div>

      {values.type === "gasto" && (
        <div className="space-y-2">
          <Check
            checked={values.notExpense}
            onChange={(notExpense) => set({ notExpense, ...(notExpense ? { deductible: false, limitedDeduction: false } : {}) })}
            title="No es gasto"
            hint="Dinero que sale pero no es un gasto, como el capital de la hipoteca. No resta del neto; cuenta en el flujo de caja."
          />
          {!values.notExpense && (
            <Check
              checked={values.deductible}
              onChange={(deductible) => set({ deductible, ...(deductible ? {} : { limitedDeduction: false }) })}
              title="Deducible en la Renta"
              hint="Se incluirá en el resumen para la Renta del piso."
            />
          )}
          {values.deductible && !values.notExpense && (
            <Check
              checked={values.limitedDeduction}
              onChange={(limitedDeduction) => set({ limitedDeduction })}
              title="Cuenta en el límite de intereses y reparaciones"
              hint="Intereses de financiación y gastos de reparación y conservación: juntos no pueden superar los ingresos del piso; el exceso se aplica en los 4 años siguientes."
            />
          )}
        </div>
      )}

      {used && usage && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Se usa en {plural(usage.transactions, "movimiento", "movimientos")}
          {usage.recurrings > 0 && ` y ${plural(usage.recurrings, "recurrente", "recurrentes")}`}. Solo puedes cambiar el
          nombre y las opciones fiscales; no se puede eliminar.
        </p>
      )}

      {saveError && <p className="text-sm text-rose-700">No se pudo guardar: {saveError}</p>}

      <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50">
        {submitLabel}
      </button>
      {onDelete && !used && (
        <button
          type="button"
          onClick={() => window.confirm("¿Eliminar esta categoría?") && void run(onDelete)}
          disabled={busy}
          className="w-full rounded-lg border border-rose-300 px-4 py-3 font-medium text-rose-700 disabled:opacity-50"
        >
          Eliminar categoría
        </button>
      )}
    </form>
  );
}
