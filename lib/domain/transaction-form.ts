import { parseEuros } from "./money";
import type { Category, Id, Transaction } from "./types";

/** Raw values of the transaction form (strings, as typed). */
export interface TransactionFormValues {
  date: string;
  amount: string;
  categoryId: Id;
  /** Property id, or "" for personal. */
  propertyId: string;
  concept: string;
}

export type TransactionFormErrors = Partial<Record<keyof TransactionFormValues, string>>;

export type TransactionFormResult =
  | { ok: true; value: Omit<Transaction, "id" | "recurringId"> }
  | { ok: false; errors: TransactionFormErrors };

/** Categories allowed for a property ("" = personal). */
export function categoriesFor(categories: Category[], propertyId: string): Category[] {
  const scope = propertyId ? "piso" : "personal";
  return categories.filter((c) => c.scope === scope);
}

/** Validates the form. The transaction type always comes from the category. Messages are in Spanish (UI). */
export function validateTransactionForm(values: TransactionFormValues, categories: Category[]): TransactionFormResult {
  const errors: TransactionFormErrors = {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) errors.date = "Indica una fecha.";

  const amount = parseEuros(values.amount);
  if (amount === null) errors.amount = "Importe no válido. Ejemplo: 950,50";
  else if (amount <= 0) errors.amount = "El importe debe ser mayor que 0.";

  const category = categoriesFor(categories, values.propertyId).find((c) => c.id === values.categoryId);
  if (!category) errors.categoryId = "Elige una categoría.";

  if (Object.keys(errors).length > 0 || !category || amount === null) return { ok: false, errors };

  return {
    ok: true,
    value: {
      date: values.date,
      amount,
      type: category.type,
      categoryId: category.id,
      propertyId: values.propertyId || null,
      concept: values.concept.trim(),
    },
  };
}
