import { describe, expect, it } from "vitest";
import { createSeedData, SEED_MONTHS } from "./seed";

describe("seed data", () => {
  const data = createSeedData("2026-11-02");
  const byName = (name: string) => data.categories.find((c) => c.name === name)!;

  it("has 2 flats and covers the 6 full months before today", () => {
    expect(data.properties).toHaveLength(2);
    const months = new Set(data.transactions.map((t) => t.date.slice(0, 7)));
    expect([...months].sort()).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("has a monthly rent per flat", () => {
    for (const p of data.properties) {
      const rents = data.transactions.filter((t) => t.propertyId === p.id && t.categoryId === byName("Alquiler").id);
      expect(rents).toHaveLength(SEED_MONTHS);
      expect(rents.every((t) => t.type === "ingreso" && t.recurringId)).toBe(true);
    }
  });

  it("splits each mortgage installment into interest and principal", () => {
    for (const p of data.properties) {
      const interest = data.transactions.filter((t) => t.propertyId === p.id && t.categoryId === byName("Intereses hipoteca").id);
      const principal = data.transactions.filter((t) => t.propertyId === p.id && t.categoryId === byName("Amortización capital hipoteca").id);
      expect(interest).toHaveLength(SEED_MONTHS);
      expect(principal).toHaveLength(SEED_MONTHS);
      // French schedule: interest goes down, principal goes up.
      const sorted = (xs: typeof interest) => [...xs].sort((a, b) => a.date.localeCompare(b.date)).map((t) => t.amount);
      expect(sorted(interest)[0]).toBeGreaterThan(sorted(interest)[SEED_MONTHS - 1]);
      expect(sorted(principal)[0]).toBeLessThan(sorted(principal)[SEED_MONTHS - 1]);
    }
    expect(byName("Intereses hipoteca").deductible).toBe(true);
    expect(byName("Amortización capital hipoteca").deductible).toBe(false);
  });

  it("includes IBI, community fees, insurance and personal expenses", () => {
    for (const name of ["IBI", "Comunidad", "Seguro hogar", "Seguro impago"]) {
      expect(data.transactions.some((t) => t.categoryId === byName(name).id)).toBe(true);
    }
    expect(data.transactions.filter((t) => t.propertyId === null && t.type === "gasto").length).toBeGreaterThan(10);
  });

  it("is internally consistent", () => {
    const cats = new Map(data.categories.map((c) => [c.id, c]));
    const props = new Set(data.properties.map((p) => p.id));
    for (const t of data.transactions) {
      expect(Number.isInteger(t.amount) && t.amount > 0).toBe(true);
      expect(cats.get(t.categoryId)?.type).toBe(t.type);
      expect(cats.get(t.categoryId)?.scope).toBe(t.propertyId ? "piso" : "personal");
      if (t.propertyId) expect(props.has(t.propertyId)).toBe(true);
    }
  });
});
