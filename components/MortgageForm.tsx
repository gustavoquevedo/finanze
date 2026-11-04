"use client";

import { useState } from "react";
import { todayIso } from "@/lib/domain/dates";
import { installmentsBetween, mortgagePlan, mortgageStatus } from "@/lib/domain/mortgage";
import {
  defaultMortgageCategories,
  parseRate,
  validateMortgageForm,
  type MortgageFormErrors,
  type MortgageFormValues,
} from "@/lib/domain/mortgage-form";
import { parseEuros } from "@/lib/domain/money";
import type { RecurringInput } from "@/lib/domain/recurring-form";
import { categoriesFor } from "@/lib/domain/transaction-form";
import type { Category, MortgageAdjustment, Property } from "@/lib/domain/types";
import { formatCents, formatShortDate } from "@/lib/format";
import { CategorySelect } from "./CategorySelect";
import { inputClass, labelClass } from "./form-styles";
import { FieldError } from "./TransactionForm";

interface Props {
  initial: MortgageFormValues;
  categories: Category[];
  properties: Property[];
  /** Kept when editing; the schedule preview uses them. */
  adjustments?: MortgageAdjustment[];
  creating: boolean;
  submitLabel: string;
  onSubmit: (value: RecurringInput, generatedUntil: string | null) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function MortgageForm({ initial, categories, properties, adjustments = [], creating, submitLabel, onSubmit, onDelete }: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<MortgageFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const available = categoriesFor(categories, values.propertyId);

  const set = (patch: Partial<MortgageFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key as keyof MortgageFormValues];
      return next;
    });
  };

  function changeProperty(propertyId: string) {
    const property = properties.find((p) => p.id === propertyId);
    set({
      propertyId,
      ...defaultMortgageCategories(categories, propertyId),
      ...(property && (!values.concept || values.concept.startsWith("Hipoteca")) ? { concept: `Hipoteca ${property.name}` } : {}),
    });
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
    const result = validateMortgageForm(values, categories, adjustments, creating);
    if (!result.ok) return setErrors(result.errors);
    void run(() => onSubmit(result.value, result.generatedUntil));
  }

  // Live preview.
  const today = todayIso();
  const principal = parseEuros(values.principal);
  const rate = parseRate(values.annualRate);
  const iso = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const n = iso(values.firstDate) && iso(values.lastDate) && values.lastDate > values.firstDate ? installmentsBetween(values.firstDate, values.lastDate) : 0;
  const plan =
    principal && rate !== null && n > 0 && n <= 600
      ? mortgagePlan({ principal, annualRate: rate, installments: n, startDate: values.firstDate, day: Number(values.firstDate.slice(8, 10)), adjustments })
      : null;
  const status = plan && principal ? mortgageStatus(plan, principal, today, adjustments) : null;
  const from = values.generateFrom && values.generateFrom > values.firstDate ? values.generateFrom : values.firstDate;
  const backfill = plan ? plan.filter((q) => q.date >= from && q.date <= today).length : 0;

  const field = (key: keyof MortgageFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`mg-${key}`} className={labelClass}>{label}</label>
      <input
        id={`mg-${key}`}
        className={inputClass}
        value={values[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        aria-invalid={!!errors[key]}
        {...props}
      />
      <FieldError message={errors[key]} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="mg-property" className={labelClass}>Piso</label>
        <select id="mg-property" className={inputClass} value={values.propertyId} onChange={(e) => changeProperty(e.target.value)}>
          <option value="">Personal</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {field("concept", "Concepto", { placeholder: "p. ej. Hipoteca Piso Centro" })}
      <div className="grid grid-cols-2 gap-3">
        {field("principal", "Capital prestado (€)", { inputMode: "decimal", autoComplete: "off", placeholder: "120.000" })}
        {field("annualRate", "Interés fijo (TIN %)", { inputMode: "decimal", autoComplete: "off", placeholder: "2,9" })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("firstDate", "Primera cuota", { type: "date" })}
        {field("lastDate", "Última cuota", { type: "date" })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="mg-interest" className={labelClass}>Categoría intereses</label>
          <CategorySelect
            id="mg-interest"
            categories={available.filter((c) => c.type === "gasto")}
            value={values.interestCategoryId}
            onChange={(interestCategoryId) => set({ interestCategoryId })}
            invalid={!!errors.interestCategoryId}
          />
          <FieldError message={errors.interestCategoryId} />
        </div>
        <div>
          <label htmlFor="mg-principalCat" className={labelClass}>Categoría capital</label>
          <CategorySelect
            id="mg-principalCat"
            categories={available.filter((c) => c.type === "gasto")}
            value={values.principalCategoryId}
            onChange={(principalCategoryId) => set({ principalCategoryId })}
            invalid={!!errors.principalCategoryId}
          />
          <FieldError message={errors.principalCategoryId} />
        </div>
      </div>

      {creating && (
        <div>
          {field("generateFrom", "Crear movimientos desde", { type: "date" })}
          <p className="mt-1 text-xs text-slate-500">
            Las cuotas desde esta fecha hasta hoy se crean como pendientes de confirmar. Vacío = desde la primera cuota.
          </p>
        </div>
      )}

      {plan && status && (
        <div className="space-y-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <p>
            <span className="font-medium">{n} cuotas</span> ·{" "}
            {status.next ? (
              <>cuota actual <span className="font-medium">{formatCents(status.next.payment)}</span></>
            ) : (
              "hipoteca terminada"
            )}
          </p>
          {status.last && <p>Pagadas: {status.last.number} de {n} · capital pendiente {formatCents(status.balance)}</p>}
          {status.next && (
            <p>
              Próxima: {formatShortDate(status.next.date)} {status.next.date.slice(0, 4)} · intereses{" "}
              {formatCents(status.next.interest)} + capital {formatCents(status.next.principal)}
            </p>
          )}
          <p className="text-xs text-slate-500">Intereses que quedan por pagar: {formatCents(status.remainingInterest)}</p>
          {creating && backfill > 0 && (
            <p className="text-amber-800">
              {backfill === 1 ? "Se creará 1 cuota" : `Se crearán ${backfill} cuotas`} ({backfill * 2} movimientos) hasta hoy,
              pendientes de confirmar.
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
          onClick={() => window.confirm("¿Eliminar esta hipoteca? Los movimientos ya creados se mantienen.") && void run(onDelete)}
          disabled={busy}
          className="w-full rounded-lg border border-rose-300 px-4 py-3 font-medium text-rose-700 disabled:opacity-50"
        >
          Eliminar hipoteca
        </button>
      )}
    </form>
  );
}
