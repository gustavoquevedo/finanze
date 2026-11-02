import { describe, expect, it } from "vitest";
import { mortgageSchedule } from "./mortgage";

describe("mortgageSchedule", () => {
  it("amortizes the full principal with a fixed payment", () => {
    const s = mortgageSchedule(10000000, 3, 240);
    expect(s).toHaveLength(240);
    expect(s.reduce((sum, q) => sum + q.principal, 0)).toBe(10000000);
    expect(s.at(-1)!.balance).toBe(0);
    expect(s[0].payment).toBe(55460); // 554,60 € for 100.000 € at 3% over 20 years
    expect(s[0].interest).toBe(25000);
  });

  it("handles a zero rate", () => {
    const s = mortgageSchedule(120000, 0, 12);
    expect(s.every((q) => q.interest === 0 && q.principal === 10000)).toBe(true);
  });
});
