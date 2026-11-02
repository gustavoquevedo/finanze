import type { Cents } from "./types";

export interface MortgageInstallment {
  /** 1-based installment number. */
  number: number;
  payment: Cents;
  interest: Cents;
  principal: Cents;
  /** Outstanding balance after this installment. */
  balance: Cents;
}

/**
 * French amortization schedule (fixed payment). Interest is rounded to the cent each month;
 * the last installment absorbs any rounding difference so the balance ends at 0.
 */
export function mortgageSchedule(principal: Cents, annualRatePercent: number, months: number): MortgageInstallment[] {
  const r = annualRatePercent / 100 / 12;
  const payment = Math.round(r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months)));
  const result: MortgageInstallment[] = [];
  let balance = principal;
  for (let n = 1; n <= months; n++) {
    const interest = Math.round(balance * r);
    const amortized = n === months ? balance : Math.min(payment - interest, balance);
    balance -= amortized;
    result.push({ number: n, payment: interest + amortized, interest, principal: amortized, balance });
  }
  return result;
}
