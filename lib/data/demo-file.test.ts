import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { createLocalRepository, emptySnapshot } from "./local";
import { createMemoryStorage } from "./memory-storage";
import { createSeedData } from "./seed";

describe("demo file (public/importacion/demo-completo.json)", () => {
  const text = readFileSync(path.resolve(__dirname, "../../public/importacion/demo-completo.json"), "utf8");

  it("is a valid import with every section filled", () => {
    const r = parseBackup(text);
    if (!r.ok) throw new Error(r.error);
    for (const [section, count] of Object.entries(r.summary)) expect(count, section).toBeGreaterThan(0);
    const months = new Set(r.data.transactions.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBe(12);
    expect(r.data.recurrings.some((x) => x.frequency === "trimestral")).toBe(true);
    expect(r.data.recurrings.some((x) => x.mortgage?.adjustments.length)).toBe(true);
  });

  it("imports and generates the pending payments due since", async () => {
    const r = parseBackup(text);
    if (!r.ok) throw new Error(r.error);
    const repo = createLocalRepository({ storage: createMemoryStorage() });
    await repo.replaceAll(r.data);
    expect(await repo.generateDueTransactions("2026-11-04")).toBeGreaterThan(0);
  });
});

describe("seed options", () => {
  it("fills the requested number of months", () => {
    const d = createSeedData("2026-11-04", { months: 12 });
    expect(new Set(d.transactions.map((t) => t.date.slice(0, 7))).size).toBe(12);
    expect(d.assetSnapshots.filter((s) => s.assetId === d.assets[0].id)).toHaveLength(12);
  });
});

describe("delete all data", () => {
  it("leaves every collection empty", async () => {
    const repo = createLocalRepository({ storage: createMemoryStorage(), initialData: () => createSeedData("2026-11-04") });
    await repo.replaceAll(emptySnapshot());
    expect(await repo.exportSnapshot()).toEqual(emptySnapshot());
  });
});
