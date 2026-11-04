import { describe, expect, it } from "vitest";
import { annualSummary, availableYears } from "./summary";
import type { Category, Transaction } from "./types";

const categories: Category[] = [
  { id: "rent", name: "Alquiler", type: "ingreso", scope: "piso", deductible: false },
  { id: "ibi", name: "IBI", type: "gasto", scope: "piso", deductible: true },
  { id: "capital", name: "Capital", type: "gasto", scope: "piso", deductible: false },
  { id: "food", name: "Comida", type: "gasto", scope: "personal", deductible: false },
];

let n = 0;
const tx = (date: string, categoryId: string, amount: number, propertyId: string | null = "a", confirmed = true): Transaction => ({
  id: String(n++),
  date,
  amount,
  categoryId,
  propertyId,
  confirmed,
  type: categories.find((c) => c.id === categoryId)!.type,
  concept: "",
  recurringId: null,
});

const data = [
  tx("2026-01-01", "rent", 100000),
  tx("2026-02-01", "rent", 100000, "a", false),
  tx("2026-03-01", "ibi", 30000),
  tx("2026-03-02", "capital", 20000),
  tx("2026-03-03", "ibi", 10000, "b"),
  tx("2026-01-10", "food", 5000, null),
  tx("2025-12-31", "rent", 99900),
];

describe("annualSummary", () => {
  it("totals by category and month for the year", () => {
    const s = annualSummary(data, categories, { year: 2026 });
    expect(s.totals).toEqual({ income: 200000, expense: 65000, net: 135000 });
    expect(s.expense.map((c) => [c.category.id, c.amount, c.count])).toEqual([["ibi", 40000, 2], ["capital", 20000, 1], ["food", 5000, 1]]);
    expect(s.months).toHaveLength(12);
    expect(s.months[0]).toEqual({ month: "2026-01", income: 100000, expense: 5000, net: 95000 });
    expect(s.months[2].expense).toBe(60000);
    expect(s.pending).toBe(1);
  });

  it("filters by property or personal", () => {
    expect(annualSummary(data, categories, { year: 2026, propertyId: "a" }).totals).toEqual({ income: 200000, expense: 50000, net: 150000 });
    expect(annualSummary(data, categories, { year: 2026, propertyId: null }).totals.expense).toBe(5000);
  });

  it("filters expenses by deductibility, keeping income", () => {
    const ded = annualSummary(data, categories, { year: 2026, propertyId: "a", deductible: "deducibles" });
    expect(ded.totals).toEqual({ income: 200000, expense: 30000, net: 170000 });
    const non = annualSummary(data, categories, { year: 2026, propertyId: "a", deductible: "no-deducibles" });
    expect(non.expense.map((c) => c.category.id)).toEqual(["capital"]);
  });

  it("lists available years", () => {
    expect(availableYears(data, 2027)).toEqual([2027, 2026, 2025]);
  });
});
