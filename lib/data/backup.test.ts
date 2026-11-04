import { describe, expect, it } from "vitest";
import { backupFileName, createBackup, parseBackup } from "./backup";
import { createLocalRepository } from "./local";
import { createMemoryStorage } from "./memory-storage";
import { createSeedData } from "./seed";

const seed = () => createSeedData("2026-11-04");

describe("backup", () => {
  it("round-trips all data", async () => {
    const data = seed();
    const parsed = parseBackup(JSON.stringify(createBackup(data, new Date("2026-11-04T10:00:00Z"))));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toEqual(data);
    expect(parsed.exportedAt).toBe("2026-11-04T10:00:00.000Z");
    expect(parsed.summary).toMatchObject({ properties: 2, portfolios: 4 });

    const repo = createLocalRepository({ storage: createMemoryStorage() });
    await repo.replaceAll(parsed.data);
    expect(await repo.exportSnapshot()).toEqual(data);
  });

  it("names the file with the date", () => {
    expect(backupFileName(new Date("2026-11-04T23:00:00Z"))).toBe("finanze-copia-2026-11-04.json");
  });

  it("upgrades older backups without the newer collections or fields", () => {
    const data = seed();
    const old = {
      format: "finanze-backup",
      version: 1,
      data: {
        properties: data.properties.map((p) => {
          const old: Record<string, unknown> = { ...p };
          delete old.purchaseCosts;
          delete old.cadastralValue;
          return old;
        }),
        categories: data.categories,
        transactions: data.transactions.map((t) => ({ ...t, recurringId: null })),
        recurrings: [],
      },
    };
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed.ok && parsed.data.assets).toEqual([]);
    expect(parsed.ok && parsed.data.properties[0]).toMatchObject({ purchaseCosts: 0, cadastralValue: null });
  });

  it.each([
    ["not JSON", "{nope", "JSON"],
    ["another file", JSON.stringify({ hello: 1 }), "No es una copia"],
    ["a newer version", JSON.stringify({ format: "finanze-backup", version: 99, data: {} }), "más nueva"],
    ["a damaged collection", JSON.stringify({ format: "finanze-backup", version: 1, data: { transactions: [{ amount: 1 }] } }), "dañada"],
  ])("rejects %s", (_label, text, message) => {
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toContain(message);
  });

  it("rejects broken references", () => {
    const data = seed();
    data.transactions[0] = { ...data.transactions[0], categoryId: "missing" };
    const parsed = parseBackup(JSON.stringify(createBackup(data)));
    expect(!parsed.ok && parsed.error).toContain("la categoría «missing» no existe");
  });
});
