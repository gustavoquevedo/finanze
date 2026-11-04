import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { isUuid, newId, remapIds } from "./ids";
import { createLocalRepository } from "./local";
import { createMemoryStorage } from "./memory-storage";
import { createSeedData } from "./seed";

describe("remapIds", () => {
  it("keeps UUID data unchanged", () => {
    const seed = createSeedData("2026-11-04");
    expect(remapIds(seed)).toEqual(seed);
    expect(isUuid(newId())).toBe(true);
  });

  it("turns readable ids into UUIDs, keeping every reference consistent", async () => {
    const text = readFileSync(path.resolve(__dirname, "../../public/importacion/ejemplo-copia.json"), "utf8");
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const data = remapIds(parsed.data);
    const all = Object.values(data).flat() as { id: string }[];
    expect(all.every((x) => isUuid(x.id))).toBe(true);
    // Still a valid file: references resolve.
    const again = parseBackup(JSON.stringify({ format: "finanze-backup", version: 1, data }));
    expect(again.ok).toBe(true);
    const rent = data.recurrings.find((r) => r.concept === "Alquiler Piso Centro")!;
    expect(data.transactions.filter((t) => t.recurringId === rent.id)).toHaveLength(2);
    const bogle = data.portfolios.find((p) => p.name === "Bogle")!;
    expect(data.portfolios.find((p) => p.id === bogle.parentId)!.name).toBe("Indexada");
    // And it imports.
    const repo = createLocalRepository({ storage: createMemoryStorage() });
    await repo.replaceAll(data);
    expect((await repo.listTransactions()).length).toBe(11);
  });
});
