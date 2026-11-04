import type { Category, Cents, Id, Transaction } from "./types";

export interface Totals {
  income: Cents;
  /** Real expenses: excludes categories marked as `notExpense`. */
  expense: Cents;
  /** income − expense (profitability). */
  net: Cents;
  /** Money out that is not an expense (mortgage principal). */
  principal: Cents;
  /** net − principal: what actually enters or leaves the account. */
  cashFlow: Cents;
}

/** Totals for a list of transactions. Unknown categories count as normal expenses. */
export function computeTotals(transactions: Transaction[], categories: Category[] | Map<Id, Category>): Totals {
  const byId = categories instanceof Map ? categories : new Map(categories.map((c) => [c.id, c]));
  let income = 0;
  let expense = 0;
  let principal = 0;
  for (const t of transactions) {
    if (t.type === "ingreso") income += t.amount;
    else if (byId.get(t.categoryId)?.notExpense) principal += t.amount;
    else expense += t.amount;
  }
  const net = income - expense;
  return { income, expense, net, principal, cashFlow: net - principal };
}
