import { describe, expect, it } from "vitest";
import { validateRecurringForm, type RecurringFormValues } from "./recurring-form";
import type { Category } from "./types";

const categories: Category[] = [
  { id: "ibi", name: "IBI", type: "gasto", scope: "piso", deductible: true, notExpense: false, limitedDeduction: false },
  { id: "salary", name: "Nómina", type: "ingreso", scope: "personal", deductible: false, notExpense: false, limitedDeduction: false },
];

const values = (o: Partial<RecurringFormValues> = {}): RecurringFormValues => ({
  propertyId: "flat1",
  categoryId: "ibi",
  amount: "150",
  concept: " IBI 1er plazo ",
  frequency: "anual",
  startDate: "2027-03-01",
  endDate: "",
  ...o,
});

describe("recurring form", () => {
  it("builds a rule, taking day from the first date and type from the category", () => {
    expect(validateRecurringForm(values(), categories)).toEqual({
      ok: true,
      value: {
        concept: "IBI 1er plazo", amount: 15000, type: "gasto", categoryId: "ibi", propertyId: "flat1",
        frequency: "anual", day: 1, startDate: "2027-03-01", endDate: null,
      },
    });
  });

  it("reports invalid fields", () => {
    const r = validateRecurringForm(values({ amount: "x", concept: "", startDate: "", categoryId: "salary" }), categories);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["amount", "categoryId", "concept", "startDate"]);
    const end = validateRecurringForm(values({ endDate: "2027-01-01" }), categories);
    expect(!end.ok && end.errors.endDate).toBeTruthy();
  });
});
