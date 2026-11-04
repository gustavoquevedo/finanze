import { describe, expect, it } from "vitest";
import { categoriesFor, validateTransactionForm, type TransactionFormValues } from "./transaction-form";
import type { Category } from "./types";

const categories: Category[] = [
  { id: "rent", name: "Alquiler", type: "ingreso", scope: "piso", deductible: false },
  { id: "ibi", name: "IBI", type: "gasto", scope: "piso", deductible: true },
  { id: "food", name: "Alimentación", type: "gasto", scope: "personal", deductible: false },
];

const values = (o: Partial<TransactionFormValues> = {}): TransactionFormValues => ({
  date: "2026-11-04",
  amount: "950,50",
  categoryId: "rent",
  propertyId: "flat1",
  concept: "  Alquiler noviembre ",
  ...o,
});

describe("transaction form", () => {
  it("filters categories by scope", () => {
    expect(categoriesFor(categories, "flat1").map((c) => c.id)).toEqual(["rent", "ibi"]);
    expect(categoriesFor(categories, "").map((c) => c.id)).toEqual(["food"]);
  });

  it("builds a transaction taking the type from the category", () => {
    expect(validateTransactionForm(values(), categories)).toEqual({
      ok: true,
      value: { date: "2026-11-04", amount: 95050, type: "ingreso", categoryId: "rent", propertyId: "flat1", concept: "Alquiler noviembre" },
    });
    const personal = validateTransactionForm(values({ propertyId: "", categoryId: "food" }), categories);
    expect(personal.ok && personal.value).toMatchObject({ type: "gasto", propertyId: null });
  });

  it("reports errors for every invalid field", () => {
    const result = validateTransactionForm(values({ date: "", amount: "0", categoryId: "" }), categories);
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["amount", "categoryId", "date"]);
  });

  it("rejects a category from the wrong scope", () => {
    const result = validateTransactionForm(values({ propertyId: "", categoryId: "rent" }), categories);
    expect(!result.ok && result.errors.categoryId).toBeTruthy();
  });
});
