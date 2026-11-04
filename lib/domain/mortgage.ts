import { addMonths, dayInMonth } from "./dates";
import type { Cents, IsoDate, MortgageAdjustment } from "./types";

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

/** Fixed monthly payment for a balance over `months` (French system), rounded to the cent. */
export function annuityPayment(balance: Cents, annualRatePercent: number, months: number): Cents {
  const r = annualRatePercent / 100 / 12;
  if (months <= 0) return balance;
  return Math.round(r === 0 ? balance / months : (balance * r) / (1 - Math.pow(1 + r, -months)));
}

export interface DatedInstallment extends MortgageInstallment {
  date: IsoDate;
  /** Total installments. */
  of: number;
  /** An adjustment was applied just before this installment. */
  adjusted: boolean;
}

export interface MortgagePlanInput {
  principal: Cents;
  annualRate: number;
  installments: number;
  /** Date of the first installment. */
  startDate: IsoDate;
  /** Day of the month of each installment. */
  day: number;
  adjustments: MortgageAdjustment[];
}

/**
 * Dated French-system schedule with adjustments: an adjustment sets the real outstanding balance at
 * its date (after any installment on or before it) and the payment is recalculated for the
 * remaining installments. Stops early if the balance reaches 0.
 */
export function mortgagePlan(input: MortgagePlanInput): DatedInstallment[] {
  const { annualRate, installments: n, startDate, day } = input;
  const r = annualRate / 100 / 12;
  const adjustments = [...input.adjustments].sort((a, b) => a.date.localeCompare(b.date));
  const startMonth = startDate.slice(0, 7);
  const result: DatedInstallment[] = [];
  let balance = input.principal;
  let payment = annuityPayment(balance, annualRate, n);
  let next = 0;

  for (let k = 1; k <= n; k++) {
    const date = dayInMonth(addMonths(startMonth, k - 1), day);
    let adjusted = false;
    while (next < adjustments.length && adjustments[next].date < date) {
      balance = adjustments[next].balance;
      payment = annuityPayment(balance, annualRate, n - k + 1);
      adjusted = true;
      next++;
    }
    if (balance <= 0) break;
    const interest = Math.round(balance * r);
    const amortized = k === n ? balance : Math.max(0, Math.min(payment - interest, balance));
    balance -= amortized;
    result.push({ number: k, of: n, date, payment: interest + amortized, interest, principal: amortized, balance, adjusted });
  }
  return result;
}

export interface MortgageStatus {
  /** Last installment paid by `today` (null if none yet). */
  last: DatedInstallment | null;
  next: DatedInstallment | null;
  /** Outstanding principal after the last installment paid. */
  balance: Cents;
  remainingInterest: Cents;
  remainingInstallments: number;
}

/**
 * Progress at `today`. The outstanding balance comes from the last installment paid, unless a later
 * adjustment (up to today) sets it.
 */
export function mortgageStatus(
  plan: DatedInstallment[],
  principal: Cents,
  today: IsoDate,
  adjustments: MortgageAdjustment[] = [],
): MortgageStatus {
  const paid = plan.filter((q) => q.date <= today);
  const rest = plan.slice(paid.length);
  const last = paid.at(-1) ?? null;
  const adjustment = adjustments
    .filter((a) => a.date <= today && (!last || a.date >= last.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  return {
    last,
    next: rest[0] ?? null,
    balance: adjustment ? adjustment.balance : last ? last.balance : principal,
    remainingInterest: rest.reduce((s, q) => s + q.interest, 0),
    remainingInstallments: rest.length,
  };
}

/** Number of monthly installments from the first to the last date (inclusive). */
export function installmentsBetween(first: IsoDate, last: IsoDate): number {
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  return (ly - fy) * 12 + (lm - fm) + 1;
}
