import { addMonths, dayInMonth } from "./dates";
import type { Frequency, IsoDate, Recurring, Transaction } from "./types";

export const FREQUENCY_MONTHS: Record<Frequency, number> = { mensual: 1, trimestral: 3, anual: 12 };

type Schedule = Pick<Recurring, "frequency" | "day" | "startDate" | "endDate">;

/**
 * Occurrence dates of a rule with `after < date <= until` (`after` null = from the start).
 * Months are counted from the start date's month in steps of the frequency.
 */
export function occurrencesBetween(r: Schedule, after: IsoDate | null, until: IsoDate): IsoDate[] {
  const step = FREQUENCY_MONTHS[r.frequency];
  const last = r.endDate && r.endDate < until ? r.endDate : until;
  const result: IsoDate[] = [];
  let month = r.startDate.slice(0, 7);
  // Skip ahead to (roughly) `after` so old rules don't loop over every past month.
  if (after && after.slice(0, 7) > month) {
    const gap = monthDiff(month, after.slice(0, 7));
    month = addMonths(month, Math.floor(gap / step) * step);
  }
  while (month <= last.slice(0, 7)) {
    const date = dayInMonth(month, r.day);
    if (date >= r.startDate && date <= last && (!after || date > after)) result.push(date);
    month = addMonths(month, step);
  }
  return result;
}

/** First occurrence strictly after `after`, or `null` if the rule has ended. */
export function nextOccurrence(r: Schedule, after: IsoDate): IsoDate | null {
  const horizon = `${Number(after.slice(0, 4)) + 2}${after.slice(4)}`;
  return occurrencesBetween(r, after, horizon)[0] ?? null;
}

export interface GenerationPlan {
  /** New pending transactions, without id. */
  transactions: Omit<Transaction, "id">[];
  /** New `generatedUntil` for each rule that was processed. */
  generatedUntil: Map<string, IsoDate>;
}

/**
 * Pending transactions for every occurrence due by `today` that has not been generated yet.
 * Pure: the caller stores the result.
 */
export function planRecurringGeneration(recurrings: Recurring[], today: IsoDate): GenerationPlan {
  const plan: GenerationPlan = { transactions: [], generatedUntil: new Map() };
  for (const r of recurrings) {
    if (r.generatedUntil && r.generatedUntil >= today) continue;
    for (const date of occurrencesBetween(r, r.generatedUntil, today)) {
      plan.transactions.push({
        date,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId,
        propertyId: r.propertyId,
        concept: r.concept,
        recurringId: r.id,
        confirmed: false,
      });
    }
    plan.generatedUntil.set(r.id, today);
  }
  return plan;
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
