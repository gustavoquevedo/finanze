import { beforeEach, describe, expect, it } from "vitest";
import { createLocalRepository } from "./local";
import { createMemoryStorage } from "./memory-storage";
import { ConstraintError, type Repository } from "./repository";
import { createSeedData } from "./seed";

let repo: Repository;

beforeEach(() => {
  repo = createLocalRepository({ storage: createMemoryStorage() });
});

const flat = () =>
  repo.createProperty({
    name: "Piso", address: "", purchaseDate: "2020-01-01", acquisitionPrice: 10000000, purchaseCosts: 0,
    cadastralValue: null, constructionPercentage: 60, active: true,
  });

describe("assets and snapshots", () => {
  it("creates a real estate asset for each flat, once", async () => {
    const p = await flat();
    expect(await repo.syncPropertyAssets()).toBe(1);
    expect(await repo.syncPropertyAssets()).toBe(0);
    const [a] = await repo.listAssets();
    expect(a).toMatchObject({ kind: "inmobiliario", propertyId: p.id });
    await expect(repo.deleteAsset(a.id)).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.createAsset({ name: "X", kind: "inmobiliario", propertyId: null, active: true })).rejects.toBeInstanceOf(ConstraintError);
  });

  it("deleting a flat removes its asset, snapshots and memberships", async () => {
    const p = await flat();
    await repo.syncPropertyAssets();
    const [a] = await repo.listAssets();
    await repo.saveAssetSnapshot({ assetId: a.id, date: "2026-01-01", value: 1, purchaseValue: null, fiscalCost: null });
    const pf = await repo.createPortfolio({ name: "Todo", parentId: null, assetIds: [a.id] });
    await repo.deleteProperty(p.id);
    expect(await repo.listAssets()).toEqual([]);
    expect(await repo.listAssetSnapshots()).toEqual([]);
    expect((await repo.listPortfolios()).find((x) => x.id === pf.id)!.assetIds).toEqual([]);
  });

  it("keeps one snapshot per asset and date, sorted by date", async () => {
    const a = await repo.createAsset({ name: " Fondo ", kind: "fondo", propertyId: null, active: true });
    expect(a.name).toBe("Fondo");
    await repo.saveAssetSnapshot({ assetId: a.id, date: "2026-02-01", value: 200, purchaseValue: null, fiscalCost: null });
    await repo.saveAssetSnapshot({ assetId: a.id, date: "2026-01-01", value: 100, purchaseValue: 90, fiscalCost: 80 });
    await repo.saveAssetSnapshot({ assetId: a.id, date: "2026-02-01", value: 250, purchaseValue: null, fiscalCost: null });
    expect((await repo.listAssetSnapshots(a.id)).map((s) => [s.date, s.value])).toEqual([["2026-01-01", 100], ["2026-02-01", 250]]);
    await expect(repo.saveAssetSnapshot({ assetId: a.id, date: "x", value: 1, purchaseValue: null, fiscalCost: null })).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.saveAssetSnapshot({ assetId: a.id, date: "2026-03-01", value: 1.5, purchaseValue: null, fiscalCost: null })).rejects.toBeInstanceOf(ConstraintError);
  });

  it("deleting an asset removes its snapshots and portfolio memberships", async () => {
    const a = await repo.createAsset({ name: "Fondo", kind: "fondo", propertyId: null, active: true });
    await repo.saveAssetSnapshot({ assetId: a.id, date: "2026-01-01", value: 100, purchaseValue: null, fiscalCost: null });
    const pf = await repo.createPortfolio({ name: "Bogle", parentId: null, assetIds: [a.id, a.id] });
    expect(pf.assetIds).toEqual([a.id]);
    await repo.deleteAsset(a.id);
    expect(await repo.listAssetSnapshots()).toEqual([]);
    expect((await repo.listPortfolios())[0].assetIds).toEqual([]);
  });
});

describe("portfolios", () => {
  it("nests portfolios and rejects cycles", async () => {
    const root = await repo.createPortfolio({ name: "Raíz", parentId: null, assetIds: [] });
    const child = await repo.createPortfolio({ name: "Hija", parentId: root.id, assetIds: [] });
    const grandchild = await repo.createPortfolio({ name: "Nieta", parentId: child.id, assetIds: [] });
    await expect(repo.updatePortfolio(root.id, { parentId: grandchild.id })).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.updatePortfolio(root.id, { parentId: root.id })).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.createPortfolio({ name: "X", parentId: null, assetIds: ["nope"] })).rejects.toBeInstanceOf(ConstraintError);
  });

  it("deleting a portfolio moves its children up", async () => {
    const root = await repo.createPortfolio({ name: "Raíz", parentId: null, assetIds: [] });
    const child = await repo.createPortfolio({ name: "Hija", parentId: root.id, assetIds: [] });
    const grandchild = await repo.createPortfolio({ name: "Nieta", parentId: child.id, assetIds: [] });
    await repo.deletePortfolio(child.id);
    expect((await repo.listPortfolios()).find((p) => p.id === grandchild.id)!.parentId).toBe(root.id);
  });

  it("seed data is consistent", async () => {
    const seeded = createLocalRepository({ storage: createMemoryStorage(), initialData: () => createSeedData("2026-11-04") });
    expect(await seeded.syncPropertyAssets()).toBe(0);
    const assets = await seeded.listAssets();
    expect(assets.filter((a) => a.kind === "inmobiliario")).toHaveLength(2);
    const portfolios = await seeded.listPortfolios();
    const rv = assets.find((a) => a.name.startsWith("Fondo indexado RV"))!;
    expect(portfolios.filter((p) => p.assetIds.includes(rv.id)).map((p) => p.name).sort()).toEqual(["Bogle", "Renta variable"]);
  });
});
