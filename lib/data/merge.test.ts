import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { emptySnapshot } from "./local";
import { mergeSnapshot } from "./merge";
import { createSeedData } from "./seed";

const reparse = (data: ReturnType<typeof createSeedData>) => parseBackup(JSON.stringify({ format: "finanze-backup", version: 1, data }));

describe("mergeSnapshot", () => {
  it("adds categories and types without touching existing data, reusing same names", () => {
    const current = createSeedData("2026-11-04");
    current.categories[0].icon = null; // «Alquiler» without icon
    const incoming = { ...emptySnapshot(), categories: createSeedData("2026-11-04").categories, assetTypes: [
      { id: "t1", name: "renta variable", icon: "trending-up" },
      { id: "t2", name: "Oro", icon: "gem" },
    ] };
    incoming.categories.push({ ...incoming.categories[0], id: "x", name: "Plaza de garaje", icon: "car" });
    const { data, added, reused } = mergeSnapshot(current, incoming);
    expect(reused).toEqual({ categories: 19, assetTypes: 1 });
    expect(added.categories).toBe(1);
    expect(added.assetTypes).toBe(1);
    expect(data.transactions).toEqual(current.transactions);
    expect(data.categories.find((c) => c.name === "Alquiler")!.icon).toBe("key");
    expect(data.assetTypes.map((t) => t.name)).toContain("Oro");
    expect(reparse(data).ok).toBe(true);
  });

  it("adds a whole data set with new ids, keeping references", () => {
    const current = createSeedData("2026-11-04");
    const incoming = createSeedData("2026-11-04");
    const { data, added } = mergeSnapshot(current, incoming);
    expect(added.transactions).toBe(incoming.transactions.length);
    expect(data.transactions).toHaveLength(current.transactions.length * 2);
    expect(data.properties).toHaveLength(4);
    // Categories are shared, not duplicated.
    expect(data.categories).toHaveLength(current.categories.length);
    const ids = data.transactions.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const r = reparse(data);
    expect(r.ok ? "" : r.error).toBe("");
  });

  it("into an empty account it is like importing", () => {
    const incoming = createSeedData("2026-11-04");
    const { data } = mergeSnapshot(emptySnapshot(), incoming);
    expect(data.transactions).toHaveLength(incoming.transactions.length);
    expect(reparse(data).ok).toBe(true);
  });
});
