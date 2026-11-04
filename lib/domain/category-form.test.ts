import { describe, expect, it } from "vitest";
import { validateCategoryForm } from "./category-form";
import type { Category } from "./types";

const existing: Category[] = [{ id: "c1", name: "Reparación", type: "gasto", scope: "piso", deductible: true, notExpense: false, limitedDeduction: false, icon: null }];

describe("category form", () => {
  it("trims the name and builds the category", () => {
    expect(validateCategoryForm({ name: "  Muebles   y enseres ", type: "gasto", scope: "piso", deductible: true, notExpense: false, limitedDeduction: false, icon: null }, existing)).toEqual({
      ok: true,
      value: { name: "Muebles y enseres", type: "gasto", scope: "piso", deductible: true, notExpense: false, limitedDeduction: false, icon: null },
    });
  });

  it("requires a name unique within scope and type, ignoring case and accents", () => {
    const v = { name: "reparacion", type: "gasto" as const, scope: "piso" as const, deductible: false, notExpense: false, limitedDeduction: false, icon: null };
    expect(validateCategoryForm({ ...v, name: " " }, existing).ok).toBe(false);
    expect(validateCategoryForm(v, existing).ok).toBe(false);
    expect(validateCategoryForm(v, existing, "c1").ok).toBe(true);
    expect(validateCategoryForm({ ...v, scope: "personal" }, existing).ok).toBe(true);
  });

  it("keeps the tax flags consistent", () => {
    const v = { name: "X", scope: "piso" as const, deductible: true, notExpense: true, limitedDeduction: true, icon: null };
    const notExpense = validateCategoryForm({ ...v, type: "gasto" }, existing);
    expect(notExpense.ok && notExpense.value).toMatchObject({ notExpense: true, deductible: false, limitedDeduction: false, icon: null });
    const income = validateCategoryForm({ ...v, type: "ingreso" }, existing);
    expect(income.ok && income.value).toMatchObject({ notExpense: false, deductible: false, limitedDeduction: false, icon: null });
    const limited = validateCategoryForm({ ...v, type: "gasto", notExpense: false }, existing);
    expect(limited.ok && limited.value).toMatchObject({ deductible: true, limitedDeduction: true, icon: null });
  });
});
