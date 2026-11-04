import { describe, expect, it } from "vitest";
import { defaultMortgageCategories, parseRate, validateMortgageForm, type MortgageFormValues } from "./mortgage-form";
import type { Category } from "./types";

const c = (id: string, name: string, o: Partial<Category> = {}): Category => ({
  id, name, type: "gasto", scope: "piso", deductible: false, notExpense: false, limitedDeduction: false, ...o,
});
const categories = [
  c("rep", "Reparaciones", { deductible: true, limitedDeduction: true }),
  c("int", "Intereses hipoteca", { deductible: true, limitedDeduction: true }),
  c("cap", "Capital", { notExpense: true }),
];
const values = (o: Partial<MortgageFormValues> = {}): MortgageFormValues => ({
  propertyId: "a", concept: " Hipoteca Centro ", principal: "120.000", annualRate: "2,9", firstDate: "2019-04-02",
  lastDate: "2044-03-02", interestCategoryId: "int", principalCategoryId: "cap", generateFrom: "", interestMethod: "mensual", ...o,
});

describe("mortgage form", () => {
  it("parses rates", () => {
    expect(parseRate("2,9")).toBe(2.9);
    expect(parseRate("3.45 %")).toBe(3.45);
    expect(parseRate("abc")).toBeNull();
    expect(parseRate("45")).toBeNull();
  });

  it("suggests interest and principal categories", () => {
    expect(defaultMortgageCategories(categories, "a")).toEqual({ interestCategoryId: "int", principalCategoryId: "cap" });
    expect(defaultMortgageCategories(categories, "")).toEqual({ interestCategoryId: "", principalCategoryId: "" });
  });

  it("builds a mortgage recurring with the computed installment", () => {
    const r = validateMortgageForm(values(), categories);
    expect(r.ok && r.value).toMatchObject({
      kind: "hipoteca", concept: "Hipoteca Centro", amount: 56283, categoryId: "int", day: 2, frequency: "mensual",
      startDate: "2019-04-02", endDate: "2044-03-02",
      mortgage: { principal: 12000000, annualRate: 2.9, installments: 300, interestMethod: "mensual", principalCategoryId: "cap", adjustments: [] },
    });
    expect(r.ok && r.generatedUntil).toBeNull();
  });

  it("generates past installments from the chosen date", () => {
    const r = validateMortgageForm(values({ generateFrom: "2026-01-01" }), categories);
    expect(r.ok && r.generatedUntil).toBe("2025-12-31");
  });

  it("reports invalid fields", () => {
    const r = validateMortgageForm(values({ principal: "", annualRate: "x", lastDate: "2018-01-01", principalCategoryId: "int" }), categories);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["annualRate", "lastDate", "principal", "principalCategoryId"]);
  });
});
