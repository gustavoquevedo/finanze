import { describe, expect, it } from "vitest";
import {
  allocationByType,
  canBeParent,
  portfolioAssetIds,
  portfolioView,
  sumValuations,
  UNTYPED,
  valueAsset,
  type ValuationContext,
} from "./investments";
import type { Asset, AssetSnapshot, Portfolio, Property, Recurring } from "./types";

const asset = (id: string, kind: Asset["kind"] = "fondo", propertyId: string | null = null): Asset => ({
  id, name: id.toUpperCase(), kind, propertyId, assetTypeId: null, active: true,
});
let n = 0;
const snap = (assetId: string, date: string, value: number, purchaseValue: number | null = null, fiscalCost: number | null = null): AssetSnapshot => ({
  id: String(n++), assetId, date, value, purchaseValue, fiscalCost,
});
const property: Property = {
  id: "p1", name: "Piso Centro", address: "", purchaseDate: "2019-03-15", acquisitionPrice: 16800000, purchaseCosts: 1200000,
  cadastralValue: null, constructionPercentage: 60, active: true,
};
const mortgage: Recurring = {
  id: "m1", kind: "hipoteca", concept: "Hipoteca", amount: 0, type: "gasto", categoryId: "i", propertyId: "p1", frequency: "mensual",
  day: 1, startDate: "2026-01-01", endDate: "2026-12-01", generatedUntil: null,
  mortgage: { principal: 1200000, annualRate: 0, installments: 12, interestMethod: "mensual", principalCategoryId: "c", adjustments: [] },
};
const ctx = (snapshots: AssetSnapshot[], date = "2026-11-04"): ValuationContext => ({ snapshots, properties: [property], recurrings: [mortgage], date });

describe("valueAsset", () => {
  it("uses the latest value and carries purchase value and fiscal cost forward", () => {
    const snaps = [snap("rv", "2026-01-31", 1000000, 900000, 600000), snap("rv", "2026-06-30", 1100000), snap("rv", "2026-12-31", 999)];
    const v = valueAsset(asset("rv"), ctx(snaps));
    expect(v).toMatchObject({ value: 1100000, valueDate: "2026-06-30", purchaseValue: 900000, fiscalCost: 600000, gain: 200000, fiscalGain: 500000 });
  });

  it("updates purchase value with a contribution and defaults fiscal cost to it", () => {
    const v = valueAsset(asset("etf", "etf"), ctx([snap("etf", "2026-01-01", 100000, 100000), snap("etf", "2026-02-01", 210000, 200000)]));
    expect(v).toMatchObject({ purchaseValue: 200000, fiscalCost: 200000, gain: 10000, fiscalGain: 10000 });
  });

  it("cash has no gains and an asset without snapshots has no value", () => {
    expect(valueAsset(asset("cash", "efectivo"), ctx([snap("cash", "2026-10-01", 500000)]))).toMatchObject({ gain: 0, fiscalGain: 0 });
    expect(valueAsset(asset("x"), ctx([]))).toMatchObject({ value: null, gain: null });
  });

  it("real estate takes the flat's name, cost and mortgage debt", () => {
    const v = valueAsset(asset("re", "inmobiliario", "p1"), ctx([snap("re", "2026-06-01", 25000000)]));
    expect(v).toMatchObject({ name: "Piso Centro", purchaseValue: 18000000, gain: 7000000, debt: 100000 });
  });
});

describe("portfolios", () => {
  const assets = ["rv", "rf", "etf", "cash"].map((id) => asset(id, id === "cash" ? "efectivo" : "fondo"));
  const snaps = [snap("rv", "2026-10-31", 600000, 500000, 400000), snap("rf", "2026-10-31", 400000, 400000), snap("etf", "2026-10-31", 300000, 200000)];
  const portfolios: Portfolio[] = [
    { id: "root", name: "Indexada", parentId: null, assetIds: ["etf"] },
    { id: "bogle", name: "Bogle", parentId: "root", assetIds: ["rv", "rf"] },
    { id: "rvar", name: "Renta variable", parentId: "root", assetIds: ["rv", "etf"] },
    { id: "liq", name: "Liquidez", parentId: null, assetIds: ["cash"] },
  ];
  const valuations = new Map(assets.map((a) => [a.id, valueAsset(a, ctx(snaps))]));

  it("counts each asset once in a portfolio tree", () => {
    expect([...portfolioAssetIds("root", portfolios)].sort()).toEqual(["etf", "rf", "rv"]);
    const view = portfolioView("root", portfolios, valuations);
    expect(view.totals).toMatchObject({ value: 1300000, purchaseValue: 1100000, gain: 200000, fiscalGain: 300000 });
  });

  it("lists children with weights, flagging overlap", () => {
    const view = portfolioView("root", portfolios, valuations);
    expect(view.children.map((c) => [c.type, c.name, c.totals.value])).toEqual([
      ["cartera", "Bogle", 1000000],
      ["cartera", "Renta variable", 900000],
      ["activo", "ETF", 300000],
    ]);
    expect(view.children[0].weight).toBeCloseTo(1000000 / 1300000);
    expect(view.overlap).toBe(true);
    expect(portfolioView("bogle", portfolios, valuations).overlap).toBe(false);
  });

  it("leaves assets without value out of the totals", () => {
    const t = portfolioView("liq", portfolios, valuations).totals;
    expect(t).toMatchObject({ value: 0, missing: 1 });
    expect(sumValuations([...valuations.values()]).value).toBe(1300000);
  });

  it("prevents cycles", () => {
    expect(canBeParent("root", "bogle", portfolios)).toBe(false);
    expect(canBeParent("root", "root", portfolios)).toBe(false);
    expect(canBeParent("bogle", "liq", portfolios)).toBe(true);
    expect(canBeParent("bogle", null, portfolios)).toBe(true);
  });
});

describe("allocationByType", () => {
  const types = [{ id: "rf", name: "Renta fija", icon: null }, { id: "rv", name: "Renta variable", icon: null }, { id: "liq", name: "Liquidez", icon: null }];
  const assets = [
    { ...asset("a"), assetTypeId: "rv" },
    { ...asset("b"), assetTypeId: "rv" },
    { ...asset("c"), assetTypeId: "rf" },
    { ...asset("d"), assetTypeId: null },
    { ...asset("e"), assetTypeId: "deleted-type" },
    { ...asset("f"), assetTypeId: "liq" },
  ];
  const snaps = [snap("a", "2026-10-31", 600), snap("b", "2026-10-31", 400), snap("c", "2026-10-31", 500), snap("d", "2026-10-31", 100), snap("e", "2026-10-31", 50)];
  const valuations = new Map(assets.map((a) => [a.id, valueAsset(a, ctx(snaps))]));

  it("groups values by type in name order, untyped last, with stable colour positions", () => {
    expect(allocationByType(["a", "b", "c", "d", "e", "f", "a"], assets, types, valuations)).toEqual([
      { id: "rf", name: "Renta fija", value: 500, colorIndex: 1, icon: null },
      { id: "rv", name: "Renta variable", value: 1000, colorIndex: 2, icon: null },
      { id: UNTYPED, name: "Sin tipo", value: 150, colorIndex: null, icon: null },
    ]);
  });

  it("only counts the given assets", () => {
    expect(allocationByType(["c"], assets, types, valuations).map((s) => s.id)).toEqual(["rf"]);
  });
});
