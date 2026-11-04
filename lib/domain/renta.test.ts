import { describe, expect, it } from "vitest";
import { depreciationFor, rentaSummary } from "./renta";
import type { Category, Property, Transaction } from "./types";

const property: Property = {
  id: "a", name: "Piso", address: "", purchaseDate: "2019-03-15", acquisitionPrice: 16800000, purchaseCosts: 1200000,
  cadastralValue: 9640000, constructionPercentage: 60, active: true,
};

const cat = (id: string, o: Partial<Category> = {}): Category => ({
  id, name: id, type: "gasto", scope: "piso", deductible: true, notExpense: false, limitedDeduction: false, ...o,
});
const categories = [
  cat("rent", { type: "ingreso", deductible: false }),
  cat("interest", { limitedDeduction: true }),
  cat("repairs", { limitedDeduction: true }),
  cat("ibi"),
  cat("capital", { deductible: false, notExpense: true }),
  cat("other", { deductible: false }),
];
let n = 0;
const tx = (categoryId: string, amount: number, o: Partial<Transaction> = {}): Transaction => ({
  id: String(n++), date: "2026-05-01", amount, categoryId, propertyId: "a", concept: "", recurringId: null, confirmed: true,
  type: categoryId === "rent" ? "ingreso" : "gasto", ...o,
});

describe("depreciationFor", () => {
  it("takes 3% of the building share of the greater value", () => {
    const d = depreciationFor(property, 2026);
    expect(d).toMatchObject({ acquisitionCost: 18000000, baseSource: "adquisicion", base: 10800000, days: 365, amount: 324000 });
    const d2 = depreciationFor({ ...property, cadastralValue: 20000000 }, 2026);
    expect(d2).toMatchObject({ baseSource: "catastral", base: 12000000, amount: 360000 });
    expect(depreciationFor({ ...property, cadastralValue: null }, 2026).baseSource).toBe("adquisicion");
  });

  it("prorates the purchase year and is 0 before buying", () => {
    const d = depreciationFor({ ...property, purchaseDate: "2026-07-02" }, 2026);
    expect(d.days).toBe(183);
    expect(d.amount).toBe(Math.round((10800000 * 0.03 * 183) / 365));
    expect(depreciationFor({ ...property, purchaseDate: "2027-01-10" }, 2026).amount).toBe(0);
    expect(depreciationFor(property, 2028).daysInYear).toBe(366);
  });
});

describe("rentaSummary", () => {
  it("adds income and deductible expenses, ignoring principal and non-deductible", () => {
    const s = rentaSummary(
      [
        tx("rent", 1000000), tx("rent", 1000000, { confirmed: false }), tx("interest", 300000), tx("repairs", 100000),
        tx("ibi", 50000), tx("capital", 400000), tx("other", 9900),
        tx("rent", 777, { date: "2025-12-31" }), tx("rent", 555, { propertyId: "b" }),
      ],
      categories,
      property,
      2026,
    );
    expect(s).toMatchObject({ income: 2000000, incomeCount: 2, limitedTotal: 400000, limitedAllowed: 400000, limitedExcess: 0, otherTotal: 50000, pending: 1 });
    expect(s.net).toBe(2000000 - 400000 - 50000 - 324000);
  });

  it("caps interest + repairs at the income and reports the excess", () => {
    const s = rentaSummary([tx("rent", 200000), tx("interest", 250000), tx("repairs", 100000), tx("ibi", 30000)], categories, property, 2026);
    expect(s).toMatchObject({ limitedTotal: 350000, limitedAllowed: 200000, limitedExcess: 150000 });
    expect(s.net).toBe(200000 - 200000 - 30000 - 324000);
  });
});
