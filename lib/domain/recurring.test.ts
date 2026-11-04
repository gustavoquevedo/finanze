import { describe, expect, it } from "vitest";
import { nextOccurrence, occurrencesBetween, planRecurringGeneration } from "./recurring";
import type { Recurring } from "./types";

const rule = (o: Partial<Recurring> = {}): Recurring => ({
  id: "r1",
  concept: "Alquiler",
  amount: 95000,
  type: "ingreso",
  categoryId: "rent",
  propertyId: "flat1",
  frequency: "mensual",
  day: 1,
  startDate: "2026-01-01",
  endDate: null,
  generatedUntil: null,
  kind: "fijo",
  mortgage: null,
  ...o,
});

describe("occurrencesBetween", () => {
  it("monthly, clamping the day to the end of the month", () => {
    const r = rule({ day: 31, startDate: "2026-01-31" });
    expect(occurrencesBetween(r, null, "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("yearly on the start date's month (IBI 1 March / 1 July)", () => {
    const first = rule({ frequency: "anual", startDate: "2025-03-01" });
    const second = rule({ frequency: "anual", startDate: "2025-07-01" });
    expect(occurrencesBetween(first, null, "2027-12-31")).toEqual(["2025-03-01", "2026-03-01", "2027-03-01"]);
    expect(occurrencesBetween(second, "2025-07-01", "2026-12-31")).toEqual(["2026-07-01"]);
  });

  it("quarterly from the start month", () => {
    const r = rule({ frequency: "trimestral", day: 15, startDate: "2026-02-15" });
    expect(occurrencesBetween(r, null, "2026-12-31")).toEqual(["2026-02-15", "2026-05-15", "2026-08-15", "2026-11-15"]);
  });

  it("respects start day, end date and `after`", () => {
    const r = rule({ day: 4, startDate: "2026-01-10", endDate: "2026-05-03" });
    expect(occurrencesBetween(r, null, "2026-12-31")).toEqual(["2026-02-04", "2026-03-04", "2026-04-04"]);
    expect(occurrencesBetween(r, "2026-03-04", "2026-12-31")).toEqual(["2026-04-04"]);
  });

  it("skips quickly over many past years", () => {
    const r = rule({ frequency: "trimestral", startDate: "1990-01-01" });
    expect(occurrencesBetween(r, "2026-02-01", "2026-07-31")).toEqual(["2026-04-01", "2026-07-01"]);
  });
});

describe("nextOccurrence", () => {
  it("finds the next date, or null when ended", () => {
    expect(nextOccurrence(rule({ frequency: "anual", startDate: "2025-03-01" }), "2026-11-04")).toBe("2027-03-01");
    expect(nextOccurrence(rule({ day: 4 }), "2026-11-04")).toBe("2026-12-04");
    expect(nextOccurrence(rule({ endDate: "2026-06-30" }), "2026-11-04")).toBeNull();
  });
});

describe("planRecurringGeneration", () => {
  it("creates pending transactions for due occurrences up to today", () => {
    const plan = planRecurringGeneration([rule({ day: 4, startDate: "2026-09-04" })], "2026-11-04");
    expect(plan.transactions.map((t) => t.date)).toEqual(["2026-09-04", "2026-10-04", "2026-11-04"]);
    expect(plan.transactions[0]).toMatchObject({ confirmed: false, recurringId: "r1", amount: 95000, type: "ingreso" });
    expect(plan.generatedUntil.get("r1")).toBe("2026-11-04");
  });

  it("does not generate again what was already generated", () => {
    const r = rule({ day: 4, startDate: "2026-09-04", generatedUntil: "2026-10-04" });
    expect(planRecurringGeneration([r], "2026-11-04").transactions.map((t) => t.date)).toEqual(["2026-11-04"]);
    expect(planRecurringGeneration([{ ...r, generatedUntil: "2026-11-04" }], "2026-11-04").transactions).toEqual([]);
  });

  it("does not create future occurrences", () => {
    expect(planRecurringGeneration([rule({ startDate: "2026-12-01" })], "2026-11-04").transactions).toEqual([]);
  });
});

describe("mortgage recurrings", () => {
  const mortgage = rule({
    kind: "hipoteca",
    concept: "Hipoteca Centro",
    amount: 56283,
    type: "gasto",
    categoryId: "interest",
    frequency: "mensual",
    day: 2,
    startDate: "2019-04-02",
    endDate: "2044-03-02",
    mortgage: { principal: 12000000, annualRate: 2.9, installments: 300, interestMethod: "mensual", principalCategoryId: "capital", adjustments: [] },
  });

  it("generates interest and principal for each due installment", () => {
    const plan = planRecurringGeneration([{ ...mortgage, generatedUntil: "2026-09-30" }], "2026-11-04");
    expect(plan.transactions.map((t) => [t.date, t.categoryId, t.concept])).toEqual([
      ["2026-10-02", "interest", "Hipoteca Centro · intereses cuota 91/300"],
      ["2026-10-02", "capital", "Hipoteca Centro · capital cuota 91/300"],
      ["2026-11-02", "interest", "Hipoteca Centro · intereses cuota 92/300"],
      ["2026-11-02", "capital", "Hipoteca Centro · capital cuota 92/300"],
    ]);
    const [i, c] = plan.transactions;
    expect(i.amount + c.amount).toBe(56283);
    expect(plan.transactions.every((t) => t.type === "gasto" && !t.confirmed)).toBe(true);
  });

  it("backfills every past installment when created without generatedUntil", () => {
    expect(planRecurringGeneration([mortgage], "2026-11-04").transactions).toHaveLength(92 * 2);
  });

  it("uses the adjusted schedule for future installments", () => {
    const adjusted = { ...mortgage, generatedUntil: "2026-09-30", mortgage: { ...mortgage.mortgage!, adjustments: [{ date: "2026-09-15", balance: 9000000, payment: null }] } };
    const [interest] = planRecurringGeneration([adjusted], "2026-10-02").transactions;
    expect(interest.amount).toBe(Math.round((9000000 * 0.029) / 12));
  });
});
