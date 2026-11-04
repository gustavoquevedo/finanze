import { addMonths, dayInMonth } from "./dates";
import { annuityPayment, installmentsBetween } from "./mortgage";
import { parseEuros } from "./money";
import type { RecurringInput } from "./recurring-form";
import { categoriesFor } from "./transaction-form";
import type { Category, MortgageAdjustment } from "./types";

export interface MortgageFormValues {
  propertyId: string;
  concept: string;
  principal: string;
  /** TIN, e.g. "2,9". */
  annualRate: string;
  firstDate: string;
  lastDate: string;
  interestCategoryId: string;
  principalCategoryId: string;
  /** Create only: generate past installments from this date. */
  generateFrom: string;
}

export type MortgageFormErrors = Partial<Record<keyof MortgageFormValues, string>>;
export type MortgageFormResult =
  | { ok: true; value: RecurringInput; generatedUntil: string | null }
  | { ok: false; errors: MortgageFormErrors };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseRate(input: string): number | null {
  const s = input.replace(/[\s%]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const rate = Number(s);
  return rate <= 30 ? rate : null;
}

/** Suggested categories for a mortgage in a scope: interest (limited deductible) and principal (not an expense). */
export function defaultMortgageCategories(categories: Category[], propertyId: string) {
  const available = categoriesFor(categories, propertyId);
  const interest =
    available.find((c) => c.limitedDeduction && /inter/i.test(c.name)) ?? available.find((c) => c.type === "gasto" && c.deductible);
  const principal = available.find((c) => c.notExpense);
  return { interestCategoryId: interest?.id ?? "", principalCategoryId: principal?.id ?? "" };
}

/** Day before an ISO date. */
function dayBefore(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Validates the mortgage form. `adjustments` are kept when editing. Messages in Spanish (UI). */
export function validateMortgageForm(
  values: MortgageFormValues,
  categories: Category[],
  adjustments: MortgageAdjustment[] = [],
  creating = true,
): MortgageFormResult {
  const errors: MortgageFormErrors = {};
  const available = categoriesFor(categories, values.propertyId);
  const principal = parseEuros(values.principal);
  if (principal === null || principal <= 0) errors.principal = "Importe no válido. Ejemplo: 120.000";
  const rate = parseRate(values.annualRate);
  if (rate === null) errors.annualRate = "Interés no válido. Ejemplo: 2,9";
  if (!values.concept.trim()) errors.concept = "Indica un concepto.";
  if (!ISO.test(values.firstDate)) errors.firstDate = "Indica la fecha de la primera cuota.";
  if (!ISO.test(values.lastDate)) errors.lastDate = "Indica la fecha de la última cuota.";
  else if (ISO.test(values.firstDate) && values.lastDate <= values.firstDate) errors.lastDate = "Debe ser posterior a la primera cuota.";
  const n = !errors.firstDate && !errors.lastDate ? installmentsBetween(values.firstDate, values.lastDate) : 0;
  if (n > 600) errors.lastDate = "Plazo máximo: 50 años.";
  const interest = available.find((c) => c.id === values.interestCategoryId && c.type === "gasto");
  if (!interest) errors.interestCategoryId = "Elige la categoría de intereses.";
  const principalCat = available.find((c) => c.id === values.principalCategoryId && c.type === "gasto");
  if (!principalCat) errors.principalCategoryId = "Elige la categoría de capital.";
  else if (principalCat.id === values.interestCategoryId) errors.principalCategoryId = "Debe ser distinta de la de intereses.";
  if (creating && values.generateFrom && !ISO.test(values.generateFrom)) errors.generateFrom = "Fecha no válida.";

  if (Object.keys(errors).length > 0 || principal === null || rate === null || !interest || !principalCat) {
    return { ok: false, errors };
  }
  const day = Number(values.firstDate.slice(8, 10));
  const from = values.generateFrom && values.generateFrom > values.firstDate ? values.generateFrom : values.firstDate;
  return {
    ok: true,
    generatedUntil: creating ? (from > values.firstDate ? dayBefore(from) : null) : null,
    value: {
      kind: "hipoteca",
      concept: values.concept.trim(),
      amount: annuityPayment(principal, rate, n),
      type: "gasto",
      categoryId: interest.id,
      propertyId: values.propertyId || null,
      frequency: "mensual",
      day,
      startDate: values.firstDate,
      // The last installment falls on the same day of the month as the first.
      endDate: dayInMonth(addMonths(values.firstDate.slice(0, 7), n - 1), day),
      mortgage: { principal, annualRate: rate, installments: n, principalCategoryId: principalCat.id, adjustments },
    },
  };
}
