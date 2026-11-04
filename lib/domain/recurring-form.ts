import { parseEuros } from "./money";
import { categoriesFor } from "./transaction-form";
import type { Category, Frequency, Recurring } from "./types";

/** Raw values of the recurring form. The day of the month comes from the first date. */
export interface RecurringFormValues {
  propertyId: string;
  categoryId: string;
  amount: string;
  concept: string;
  frequency: Frequency;
  /** First occurrence, `YYYY-MM-DD`. */
  startDate: string;
  /** Optional, `""` = no end. */
  endDate: string;
}

export type RecurringFormErrors = Partial<Record<keyof RecurringFormValues, string>>;

export type RecurringInput = Omit<Recurring, "id" | "generatedUntil">;

export type RecurringFormResult = { ok: true; value: RecurringInput } | { ok: false; errors: RecurringFormErrors };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Validates the recurring form. Messages are in Spanish (UI). */
export function validateRecurringForm(values: RecurringFormValues, categories: Category[]): RecurringFormResult {
  const errors: RecurringFormErrors = {};

  const amount = parseEuros(values.amount);
  if (amount === null) errors.amount = "Importe no válido. Ejemplo: 950,50";
  else if (amount <= 0) errors.amount = "El importe debe ser mayor que 0.";

  const category = categoriesFor(categories, values.propertyId).find((c) => c.id === values.categoryId);
  if (!category) errors.categoryId = "Elige una categoría.";

  if (!values.concept.trim()) errors.concept = "Indica un concepto, p. ej. «Alquiler».";
  if (!ISO.test(values.startDate)) errors.startDate = "Indica la fecha del primer cargo.";
  if (values.endDate && (!ISO.test(values.endDate) || values.endDate < values.startDate)) {
    errors.endDate = "La fecha de fin debe ser posterior a la primera.";
  }

  if (Object.keys(errors).length > 0 || !category || amount === null) return { ok: false, errors };

  return {
    ok: true,
    value: {
      concept: values.concept.trim(),
      amount,
      type: category.type,
      categoryId: category.id,
      propertyId: values.propertyId || null,
      frequency: values.frequency,
      day: Number(values.startDate.slice(8, 10)),
      startDate: values.startDate,
      endDate: values.endDate || null,
    },
  };
}
