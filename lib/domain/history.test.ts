import { describe, expect, it } from "vitest";
import { assetHistory, firstValueDate, monthEnds, portfolioHistory, typeHistory, valuationsOverTime } from "./history";
import type { Asset, AssetSnapshot, Portfolio } from "./types";

const asset = (id: string, assetTypeId: string | null = null): Asset => ({ id, name: id.toUpperCase(), kind: "fondo", propertyId: null, assetTypeId, dailyUse: true, active: true });
let n = 0;
const snap = (assetId: string, date: string, value: number, purchaseValue: number | null = null): AssetSnapshot => ({
  id: String(n++), assetId, date, value, purchaseValue, fiscalCost: null,
});

const assets = [asset("a", "rv"), asset("b", "rf"), asset("c", "rv")];
const snapshots = [
  snap("a", "2026-01-31", 1000, 900),
  snap("a", "2026-03-15", 1200),
  snap("b", "2026-02-28", 500, 500),
  snap("c", "2026-03-31", 300, 250),
];
const ctx = { snapshots, properties: [], recurrings: [] };
const portfolios: Portfolio[] = [
  { id: "root", name: "Todo", parentId: null, assetIds: ["c"] },
  { id: "sub", name: "Bogle", parentId: "root", assetIds: ["a", "b"] },
];

describe("monthEnds", () => {
  it("lists month ends, ending at the given date", () => {
    expect(monthEnds("2026-01-10", "2026-04-04")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-04"]);
    expect(monthEnds("2025-12-01", "2026-01-31")).toEqual(["2025-12-31", "2026-01-31"]);
    expect(monthEnds("2020-01-01", "2026-12-31", 3)).toEqual(["2026-10-31", "2026-11-30", "2026-12-31"]);
  });

  it("finds the first value date", () => {
    expect(firstValueDate(["b", "c"], ctx)).toBe("2026-02-28");
    expect(firstValueDate(["zzz"], ctx)).toBeNull();
  });
});

describe("history", () => {
  const dates = monthEnds("2026-01-01", "2026-04-04");
  const perDate = valuationsOverTime(assets, ctx, dates);

  it("carries an asset's last value and purchase value forward", () => {
    const h = assetHistory("a", perDate, dates);
    expect(h.points.map((p) => [p.value, p.purchaseValue, p.gain])).toEqual([
      [1000, 900, 100], [1000, 900, 100], [1200, 900, 300], [1200, 900, 300],
    ]);
  });

  it("stacks a portfolio by its direct children; totals count each asset once", () => {
    const h = portfolioHistory("root", portfolios, perDate, dates);
    expect(h.series.map((s) => [s.name, s.colorIndex, s.values])).toEqual([
      ["Bogle", 0, [1000, 1500, 1700, 1700]],
      ["C", 1, [0, 0, 300, 300]],
    ]);
    expect(h.totals.map((t) => t.value)).toEqual([1000, 1500, 2000, 2000]);
    expect(h.totals[3].purchaseValue).toBe(900 + 500 + 250);
    expect(h.overlap).toBe(false);
  });

  it("stacks by asset type", () => {
    const types = [{ id: "rf", name: "Renta fija", icon: null }, { id: "rv", name: "Renta variable", icon: null }];
    const h = typeHistory(["a", "b", "c"], assets, types, perDate, dates);
    expect(h.series.map((s) => [s.name, s.values])).toEqual([
      ["Renta fija", [0, 500, 500, 500]],
      ["Renta variable", [1000, 1000, 1500, 1500]],
    ]);
    expect(h.totals.map((t) => t.value)).toEqual([1000, 1500, 2000, 2000]);
  });
});
