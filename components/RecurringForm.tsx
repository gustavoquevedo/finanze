"use client";

import { useState } from "react";
import { todayIso } from "@/lib/domain/dates";
import { nextOccurrence, occurrencesBetween } from "@/lib/domain/recurring";
import {
  validateRecurringForm,
  type RecurringFormErrors,
  type RecurringFormValues,
  type RecurringInput,
} from "@/lib/domain/recurring-form";
import { categoriesFor } from "@/lib/domain/transaction-form";
import type { Category, Frequency, Property } from "@/lib/domain/types";
import { describeSchedule, formatShortDate } from "@/lib/format";
import { CategoryHint, CategorySelect } from "./CategorySelect";
import { inputClass, labelClass } from "./form-styles";
import { FieldError } from "./TransactionForm";

interface Props {
  initial: RecurringFormValues;
  categories: Category[];
  properties: Property[];
  submitLabel: string;
  /** Last date already generated (editing), so the preview only counts new ones. */
  generatedUntil?: string | null;
  onSubmit: (value: RecurringInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
];

export function RecurringForm({ initial, categories, properties, submitLabel, generatedUntil = null, onSubmit, onDelete }: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<RecurringFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const available = categoriesFor(categories, values.propertyId);
  const selected = available.find((c) => c.id === values.categoryId);

  const set = (patch: Partial<RecurringFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key as keyof RecurringFormValues];
      return next;
    });
  };

  function changeProperty(propertyId: string) {
    const keep = categoriesFor(categories, propertyId).some((c) => c.id === values.categoryId);
    set({ propertyId, categoryId: keep ? values.categoryId : "" });
  }

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
    const result = validateRecurringForm(values, categories);
    if (!result.ok) return setErrors(result.errors);
    void run(() => onSubmit(result.value));
  }

  // Live preview of the schedule.
  const today = todayIso();
  const schedule = /^\d{4}-\d{2}-\d{2}$/.test(values.startDate)
    ? { frequency: values.frequency, day: Number(values.startDate.slice(8, 10)), startDate: values.startDate, endDate: values.endDate || null }
    : null;
  const next = schedule ? nextOccurrence(schedule, generatedUntil && generatedUntil > today ? generatedUntil : today) : null;
  const backfill = schedule ? occurrencesBetween(schedule, generatedUntil, today).length : 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="rc-property" className={labelClass}>Piso</label>
        <select id="rc-property" className={inputClass} value={values.propertyId} onChange={(e) => changeProperty(e.target.value)}>
          <option value="">Personal</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="rc-category" className={labelClass}>Categoría</label>
        <CategorySelect
          id="rc-category"
          categories={available}
          value={values.categoryId}
          onChange={(categoryId) => set({ categoryId })}
          invalid={!!errors.categoryId}
        />
        <CategoryHint category={selected} />
        <FieldError message={errors.categoryId} />
      </div>

      <div>
        <label htmlFor="rc-concept" className={labelClass}>Concepto</label>
        <input
          id="rc-concept"
          className={inputClass}
          placeholder="p. ej. IBI 1er plazo"
          value={values.concept}
          onChange={(e) => set({ concept: e.target.value })}
          aria-invalid={!!errors.concept}
        />
        <FieldError message={errors.concept} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="rc-amount" className={labelClass}>Importe (€)</label>
          <input
            id="rc-amount"
            className={inputClass}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={values.amount}
            onChange={(e) => set({ amount: e.target.value })}
            aria-invalid={!!errors.amount}
          />
          <FieldError message={errors.amount} />
        </div>
        <div>
          <label htmlFor="rc-frequency" className={labelClass}>Frecuencia</label>
          <select
            id="rc-frequency"
            className={inputClass}
            value={values.frequency}
            onChange={(e) => set({ frequency: e.target.value as Frequency })}
          >
            {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="rc-start" className={labelClass}>Primer cargo</label>
          <input
            id="rc-start"
            type="date"
            className={inputClass}
            value={values.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
            aria-invalid={!!errors.startDate}
          />
          <FieldError message={errors.startDate} />
        </div>
        <div>
          <label htmlFor="rc-end" className={labelClass}>Hasta (opcional)</label>
          <input
            id="rc-end"
            type="date"
            className={inputClass}
            value={values.endDate}
            onChange={(e) => set({ endDate: e.target.value })}
            aria-invalid={!!errors.endDate}
          />
          <FieldError message={errors.endDate} />
        </div>
      </div>

      {schedule && (
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <p className="font-medium">{describeSchedule(schedule)}</p>
          <p>{next ? `Próximo: ${formatShortDate(next)} ${next.slice(0, 4)}` : "Sin próximos cargos."}</p>
          {backfill > 0 && (
            <p className="mt-1 text-amber-800">
              {backfill === 1 ? "Se creará 1 movimiento" : `Se crearán ${backfill} movimientos`} hasta hoy, pendientes de confirmar.
            </p>
          )}
        </div>
      )}

      {saveError && <p className="text-sm text-rose-700">No se pudo guardar: {saveError}</p>}

      <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50">
        {submitLabel}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => window.confirm("¿Eliminar este recurrente? Los movimientos ya creados se mantienen.") && void run(onDelete)}
          disabled={busy}
          className="w-full rounded-lg border border-rose-300 px-4 py-3 font-medium text-rose-700 disabled:opacity-50"
        >
          Eliminar recurrente
        </button>
      )}
    </form>
  );
}
