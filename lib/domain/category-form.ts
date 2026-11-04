import type { Category, CategoryScope, Id, TransactionType } from "./types";

export interface CategoryFormValues {
  name: string;
  type: TransactionType;
  scope: CategoryScope;
  deductible: boolean;
  notExpense: boolean;
  limitedDeduction: boolean;
  icon: string | null;
}

export type CategoryFormResult =
  | { ok: true; value: Omit<Category, "id"> }
  | { ok: false; errors: Partial<Record<keyof CategoryFormValues, string>> };

const normalize = (s: string) => s.trim().toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Validates the category form. Names must be unique within the same scope and type
 * (ignoring case and accents). `editingId` excludes the category being edited.
 */
export function validateCategoryForm(values: CategoryFormValues, existing: Category[], editingId?: Id): CategoryFormResult {
  const name = values.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, errors: { name: "Indica un nombre." } };
  const duplicate = existing.some(
    (c) => c.id !== editingId && c.scope === values.scope && c.type === values.type && normalize(c.name) === normalize(name),
  );
  if (duplicate) return { ok: false, errors: { name: "Ya hay una categoría con ese nombre." } };
  // Keep flags consistent: a non-expense is never deductible, and only deductible expenses have a limit.
  const notExpense = values.type === "gasto" && values.notExpense;
  const deductible = values.type === "gasto" && !notExpense && values.deductible;
  const limitedDeduction = deductible && values.limitedDeduction;
  return { ok: true, value: { name, type: values.type, scope: values.scope, deductible, notExpense, limitedDeduction, icon: values.icon } };
}
