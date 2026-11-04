import { describe, expect, it } from "vitest";
import { computeTotals } from "./totals";
import type { Category, Transaction } from "./types";

const cat = (id: string, type: "ingreso" | "gasto", notExpense = false): Category => ({
  id, name: id, type, scope: "piso", deductible: false, notExpense, limitedDeduction: false, icon: null,
});
const categories = [cat("rent", "ingreso"), cat("ibi", "gasto"), cat("capital", "gasto", true)];
const tx = (categoryId: string, amount: number): Transaction => ({
  id: categoryId + amount, date: "2026-01-01", amount, categoryId, propertyId: "a", concept: "", recurringId: null, confirmed: true,
  type: categoryId === "rent" ? "ingreso" : "gasto",
});

describe("computeTotals", () => {
  it("keeps mortgage principal out of expenses and net, but in cash flow", () => {
    expect(computeTotals([tx("rent", 100000), tx("ibi", 20000), tx("capital", 30000)], categories)).toEqual({
      income: 100000, expense: 20000, net: 80000, principal: 30000, cashFlow: 50000,
    });
  });
});
