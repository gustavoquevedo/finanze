import { describe, expect, it } from "vitest";
import { isComputable, monthSpending, spendingByMonth } from "./spending";
import type { Asset, AssetSnapshot, Category, Transaction } from "./types";

const cat = (id: string, type: "ingreso" | "gasto", notExpense = false): Category => ({
  id, name: id, type, scope: "piso", deductible: false, notExpense, limitedDeduction: false, icon: null,
});
const categories = [cat("salary", "ingreso"), cat("rent", "ingreso"), cat("food", "gasto"), cat("ibi", "gasto"), cat("capital", "gasto", true)];
let n = 0;
const tx = (date: string, categoryId: string, amount: number, propertyId: string | null = null): Transaction => ({
  id: String(n++), date, amount, categoryId, propertyId, concept: "", recurringId: null, confirmed: true,
  type: categoryId === "salary" || categoryId === "rent" ? "ingreso" : "gasto",
});
const asset = (id: string, kind: Asset["kind"], dailyUse = true): Asset => ({ id, name: id, kind, propertyId: null, assetTypeId: null, dailyUse, active: true });
const snap = (assetId: string, date: string, value: number, purchaseValue: number | null = null): AssetSnapshot => ({
  id: String(n++), assetId, date, value, purchaseValue, fiscalCost: null,
});

const assets = [asset("account", "efectivo"), asset("savings", "efectivo", false), asset("fund", "fondo")];
const transactions = [
  tx("2026-10-28", "salary", 235000),
  tx("2026-10-01", "rent", 95000, "flat"),
  tx("2026-10-20", "ibi", 41200, "flat"),
  tx("2026-10-17", "food", 11800),
  tx("2026-10-02", "capital", 34000, "flat"),
  tx("2026-09-28", "salary", 235000),
];
const snapshots = [
  snap("account", "2026-09-30", 500000),
  snap("account", "2026-10-31", 590000),
  snap("savings", "2026-09-30", 1000000),
  snap("savings", "2026-10-31", 2000000), // not everyday: ignored
  snap("fund", "2026-09-30", 3000000, 2800000),
  snap("fund", "2026-10-31", 3200000, 2840000), // +400 € contributed, the rest is market gain
];
const input = { transactions, categories, assets, snapshots };

describe("monthSpending", () => {
  it("estimates unrecorded spending from income, expenses and saving", () => {
    const m = monthSpending(input, "2026-10", "2026-11-04");
    expect(m).toMatchObject({
      income: 330000, expenses: 53000, personalExpenses: 11800, principal: 34000,
      contributions: 40000, cashChange: 90000, saving: 164000, missing: [], current: false, end: "2026-10-31", trackingStart: false,
    });
    // 3300 − 530 − 1640 = 1130 € spent without recording it.
    expect(m.unrecorded).toBe(113000);
    expect(m.personalTotal).toBe(11800 + 113000);
  });

  it("flags everyday accounts without a balance in the month or the previous one", () => {
    const withoutEnd = { ...input, snapshots: snapshots.filter((s) => !(s.assetId === "account" && s.date === "2026-10-31")) };
    expect(monthSpending(withoutEnd, "2026-10", "2026-11-04").missing).toEqual(["account"]);
    const withoutStart = { ...input, snapshots: snapshots.filter((s) => !(s.assetId === "account" && s.date === "2026-09-30")) };
    expect(monthSpending(withoutStart, "2026-10", "2026-11-04").missing).toEqual([]); // opened in October: starts at 0
    expect(monthSpending(withoutStart, "2026-10", "2026-11-04").cashChange).toBe(590000);
  });

  it("uses today as the end of the current month", () => {
    const m = monthSpending(input, "2026-11", "2026-11-04");
    expect(m).toMatchObject({ current: true, end: "2026-11-04", missing: ["account"] });
  });

  it("lists the last months, newest first", () => {
    expect(spendingByMonth(input, "2026-11-04", 3).map((m) => m.month)).toEqual(["2026-11", "2026-10", "2026-09"]);
  });
});

describe("with the seed data", () => {
  it("estimates the unrecorded spending the seed leaves out (900–1.300 €/month)", async () => {
    const { createSeedData } = await import("@/lib/data/seed");
    const d = createSeedData("2026-11-04", { months: 12 });
    const all = spendingByMonth({ ...d, snapshots: d.assetSnapshots }, "2026-11-04", 13);
    expect(all.find((m) => m.month === "2025-11")!.trackingStart).toBe(true);
    const months = all.filter((m) => !m.current && isComputable(m));
    expect(months.length).toBe(11); // the first seed month is the start of tracking
    for (const m of months) {
      expect(m.unrecorded).toBeGreaterThanOrEqual(89900);
      expect(m.unrecorded).toBeLessThanOrEqual(130100);
    }
  });
});
