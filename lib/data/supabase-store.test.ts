import { describe, expect, it } from "vitest";
import { remapIds } from "./ids";
import { createSnapshotRepository } from "./local";
import { createSeedData } from "./seed";
import { createMemoryDb, createSupabaseStore } from "./supabase-store";
import { diffSnapshots, fromRows, toRows } from "./supabase-rows";
import type { Snapshot } from "@/lib/domain/types";

const seed = () => createSeedData("2026-11-04");
/** The database keeps no order: compare collections sorted by id. */
const sorted = (d: Snapshot) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, [...(v as { id: string }[])].sort((a, b) => a.id.localeCompare(b.id))]));

describe("rows", () => {
  it("round-trip every entity", () => {
    const data = seed();
    // Mortgage with adjustments and a portfolio with assets are included in the seed.
    data.recurrings.find((r) => r.mortgage)!.mortgage!.adjustments = [{ date: "2026-06-15", balance: null, payment: 56300 }];
    expect(fromRows(toRows(data))).toEqual(data);
  });

  it("reads numeric columns sent as strings", () => {
    const rows = toRows(seed());
    rows.properties[0].construction_percentage = "62.00";
    rows.recurrings.find((r) => r.kind === "hipoteca")!.mortgage_annual_rate = "2.900";
    const back = fromRows(rows);
    expect(back.properties[0].constructionPercentage).toBe(62);
    expect(back.recurrings.find((r) => r.mortgage)!.mortgage!.annualRate).toBe(2.9);
  });

  it("diffs only what changed, parents first and children deleted first", () => {
    const before = seed();
    const after = structuredClone(before);
    after.transactions[0].amount += 1;
    after.portfolios = after.portfolios.filter((p) => p.name !== "Renta variable");
    const { deletes, upserts } = diffSnapshots(before, after);
    expect(upserts).toEqual([{ table: "transactions", rows: [expect.objectContaining({ id: after.transactions[0].id })] }]);
    expect(deletes.map((d) => d.table)).toEqual(["portfolio_assets", "portfolios"]);
  });

  it("writes new sub-portfolios after their parent", () => {
    const before = seed();
    const after = structuredClone(before);
    after.portfolios.push({ id: "11111111-1111-4111-8111-111111111111", name: "Hija", parentId: "22222222-2222-4222-8222-222222222222", assetIds: [] });
    after.portfolios.push({ id: "22222222-2222-4222-8222-222222222222", name: "Madre", parentId: null, assetIds: [] });
    const portfolios = diffSnapshots(before, after).upserts.find((u) => u.table === "portfolios")!.rows;
    expect(portfolios.map((r) => r.name)).toEqual(["Madre", "Hija"]);
  });
});

describe("supabase store", () => {
  it("persists repository changes as rows and reads them back", async () => {
    const db = createMemoryDb();
    const repo = createSnapshotRepository(createSupabaseStore(db), { prepareReplace: remapIds });
    await repo.replaceAll(seed());
    expect(db.tables.transactions.length).toBe(seed().transactions.length);

    const category = (await repo.listCategories())[0];
    const created = await repo.createTransaction({
      date: "2026-11-04", amount: 1234, type: category.type, categoryId: category.id,
      propertyId: category.scope === "piso" ? (await repo.listProperties())[0].id : null,
      concept: "Prueba", recurringId: null, confirmed: true,
    });
    await repo.generateDueTransactions("2026-11-04");

    // A fresh repository on the same database sees everything.
    const other = createSnapshotRepository(createSupabaseStore(db));
    expect(sorted(await other.exportSnapshot())).toEqual(sorted(await repo.exportSnapshot()));
    expect(await other.getTransaction(created.id)).toMatchObject({ concept: "Prueba" });
  });

  it("does not generate twice when pages ask at the same time", async () => {
    const db = createMemoryDb();
    const repo = createSnapshotRepository(createSupabaseStore(db));
    await repo.replaceAll(seed());
    const counts = await Promise.all([1, 2, 3].map(() => repo.generateDueTransactions("2026-11-04")));
    expect(counts.filter((n) => n > 0)).toHaveLength(1);
    expect((await repo.listTransactions({ confirmed: false })).length).toBe(counts.reduce((s, n) => s + n, 0));
  });

  it("reloads stale data written by another device", async () => {
    const db = createMemoryDb();
    let clock = 0;
    const store = createSupabaseStore(db, { now: () => clock });
    const repo = createSnapshotRepository(store);
    await repo.replaceAll(seed());
    const elsewhere = createSnapshotRepository(createSupabaseStore(db));
    const t = (await elsewhere.listTransactions())[0];
    await elsewhere.deleteTransaction(t.id);
    expect(await repo.getTransaction(t.id)).not.toBeNull(); // still cached
    clock = 31_000;
    expect(await repo.getTransaction(t.id)).toBeNull();
  });

  it("turns readable ids into UUIDs on replace", async () => {
    const db = createMemoryDb();
    const repo = createSnapshotRepository(createSupabaseStore(db), { prepareReplace: remapIds });
    const data = seed();
    data.categories[0] = { ...data.categories[0], id: "cat-x" };
    for (const t of data.transactions) if (t.categoryId === seed().categories[0].id) t.categoryId = "cat-x";
    await repo.replaceAll(data);
    expect(db.tables.categories.some((c) => c.id === "cat-x")).toBe(false);
  });
});
