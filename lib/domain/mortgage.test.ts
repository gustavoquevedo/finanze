import { describe, expect, it } from "vitest";
import { annuityPayment, installmentsBetween, mortgagePlan, mortgageSchedule, mortgageStatus } from "./mortgage";

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

describe("mortgagePlan", () => {
  const base = { principal: 12000000, annualRate: 2.9, installments: 300, startDate: "2019-04-02", day: 2, adjustments: [] };

  it("dates installments monthly and matches the plain schedule", () => {
    const plan = mortgagePlan(base);
    expect(plan).toHaveLength(300);
    expect(plan[0]).toMatchObject({ number: 1, of: 300, date: "2019-04-02", payment: 56283, interest: 29000, principal: 27283 });
    expect(plan.at(-1)!.date).toBe("2044-03-02");
    expect(plan.map((q) => q.interest)).toEqual(mortgageSchedule(12000000, 2.9, 300).map((q) => q.interest));
  });

  it("recalculates from a real outstanding balance, for the remaining installments", () => {
    const plain = mortgagePlan(base);
    // Bank says 90.000 € pending right after installment 90 (2026-09-02).
    const plan = mortgagePlan({ ...base, adjustments: [{ date: "2026-09-15", balance: 9000000, payment: null }] });
    expect(plan.slice(0, 90)).toEqual(plain.slice(0, 90));
    const q91 = plan[90];
    expect(q91).toMatchObject({ number: 91, date: "2026-10-02", adjusted: true, interest: Math.round(9000000 * 0.029 / 12) });
    expect(q91.payment).toBe(annuityPayment(9000000, 2.9, 210));
    expect(plan).toHaveLength(300);
    expect(plan.at(-1)!.balance).toBe(0);
    expect(plan.slice(90).reduce((s, q) => s + q.principal, 0)).toBe(9000000);
  });

  it("an adjustment on an installment day applies after that installment", () => {
    const plan = mortgagePlan({ ...base, adjustments: [{ date: "2026-09-02", balance: 9000000, payment: null }] });
    expect(plan[89].adjusted).toBe(false);
    expect(plan[90].adjusted).toBe(true);
  });

  it("stops when the loan is paid off", () => {
    const plan = mortgagePlan({ ...base, adjustments: [{ date: "2026-09-15", balance: 0, payment: null }] });
    expect(plan).toHaveLength(90);
  });
});

describe("bank corrections", () => {
  const base = { principal: 12000000, annualRate: 2.9, installments: 300, startDate: "2019-04-02", day: 2, adjustments: [] };

  it("keeps the bank's payment from a date, splitting interest and principal", () => {
    const plain = mortgagePlan(base);
    const plan = mortgagePlan({ ...base, adjustments: [{ date: "2026-09-15", balance: null, payment: 56300 }] });
    expect(plan.slice(0, 90)).toEqual(plain.slice(0, 90));
    const q = plan[90];
    expect(q.interest).toBe(Math.round((plain[89].balance * 0.029) / 12));
    expect(q.payment).toBe(56300);
    expect(q.principal).toBe(56300 - q.interest);
    expect(plan.slice(90, -1).every((x) => x.payment === 56300)).toBe(true);
    // A slightly higher payment ends the loan a little early or with a smaller last one.
    expect(plan.at(-1)!.balance).toBe(0);
    expect(plan.reduce((s, x) => s + x.principal, 0)).toBe(12000000);
  });

  it("combines a real balance with the bank's payment", () => {
    const plan = mortgagePlan({ ...base, adjustments: [{ date: "2026-09-15", balance: 9000000, payment: 60000 }] });
    expect(plan[90]).toMatchObject({ interest: Math.round((9000000 * 0.029) / 12), payment: 60000 });
  });

  it("computes interest by days when the bank does", () => {
    const plan = mortgagePlan({ ...base, interestMethod: "dias365" });
    // April 2019 installment: 31 days since 2 March.
    expect(plan[0].interest).toBe(Math.round((12000000 * 0.029 * 31) / 365));
    // May: 30 days.
    expect(plan[1].interest).toBe(Math.round((plan[0].balance * 0.029 * 30) / 365));
    const by360 = mortgagePlan({ ...base, interestMethod: "dias360" });
    expect(by360[0].interest).toBe(Math.round((12000000 * 0.029 * 31) / 360));
    expect(plan.at(-1)!.balance).toBe(0);
  });
});

describe("mortgageStatus", () => {
  it("reports progress at a date", () => {
    const plan = mortgagePlan({ principal: 1200000, annualRate: 0, installments: 12, startDate: "2026-01-04", day: 4, adjustments: [] });
    const s = mortgageStatus(plan, 1200000, "2026-03-10");
    expect(s).toMatchObject({ balance: 900000, remainingInstallments: 9, remainingInterest: 0 });
    expect(s.last!.number).toBe(3);
    expect(s.next!.date).toBe("2026-04-04");
    expect(mortgageStatus(plan, 1200000, "2025-12-31").balance).toBe(1200000);
    // A real balance given after the last installment paid replaces it.
    expect(mortgageStatus(plan, 1200000, "2026-03-10", [{ date: "2026-03-05", balance: 850000, payment: null }]).balance).toBe(850000);
    expect(mortgageStatus(plan, 1200000, "2026-03-10", [{ date: "2026-03-20", balance: 850000, payment: null }]).balance).toBe(900000);
  });

  it("counts installments between dates", () => {
    expect(installmentsBetween("2019-04-02", "2044-03-02")).toBe(300);
  });
});
