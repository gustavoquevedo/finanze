import type { Totals } from "./totals";
import type { Category, Cents, Id, Transaction } from "./types";

/** Which expenses to include. Income is never filtered (rent is not "deductible" but is needed). */
export type DeductibleFilter = "todos" | "deducibles" | "no-deducibles";

export interface SummaryOptions {
  year: number;
  /** Property id, `null` = personal only, `undefined` = everything. */
  propertyId?: Id | null;
  deductible?: DeductibleFilter;
}

export interface CategoryTotal {
  category: Category;
  amount: Cents;
  count: number;
}

export interface MonthTotal {
  /** `YYYY-MM` */
  month: string;
  income: Cents;
  expense: Cents;
  net: Cents;
}

export interface AnnualSummary {
  year: number;
  income: CategoryTotal[];
  /** Real expenses (without `notExpense` categories). */
  expense: CategoryTotal[];
  /** Money out that is not an expense (mortgage principal). */
  principal: CategoryTotal[];
  totals: Totals;
  /** Always 12 months, January to December. */
  months: MonthTotal[];
  /** Pending (automatic, unconfirmed) transactions included in the totals. */
  pending: number;
}

/** Yearly totals by category and month. Pure; pending transactions are included. */
export function annualSummary(transactions: Transaction[], categories: Category[], options: SummaryOptions): AnnualSummary {
  const { year, propertyId, deductible = "todos" } = options;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const prefix = `${year}-`;

  const months: MonthTotal[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    income: 0,
    expense: 0,
    net: 0,
  }));
  const perCategory = new Map<Id, CategoryTotal>();
  let pending = 0;

  for (const t of transactions) {
    if (!t.date.startsWith(prefix)) continue;
    if (propertyId !== undefined && t.propertyId !== propertyId) continue;
    const category = byId.get(t.categoryId);
    if (!category) continue;
    // Principal is shown apart unless only deductible expenses are wanted.
    if (t.type === "gasto" && !category.notExpense && deductible !== "todos" && category.deductible !== (deductible === "deducibles")) continue;
    if (category.notExpense && deductible === "deducibles") continue;

    const entry = perCategory.get(category.id) ?? { category, amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    perCategory.set(category.id, entry);

    const m = months[Number(t.date.slice(5, 7)) - 1];
    if (t.type === "ingreso") m.income += t.amount;
    else if (!category.notExpense) m.expense += t.amount;
    if (!t.confirmed) pending += 1;
  }

  for (const m of months) m.net = m.income - m.expense;
  const sorted = [...perCategory.values()].sort((a, b) => b.amount - a.amount);
  const income = sorted.filter((c) => c.category.type === "ingreso");
  const expense = sorted.filter((c) => c.category.type === "gasto" && !c.category.notExpense);
  const principal = sorted.filter((c) => c.category.notExpense);
  const sum = (xs: CategoryTotal[]) => xs.reduce((s, x) => s + x.amount, 0);
  const net = sum(income) - sum(expense);
  const totals = { income: sum(income), expense: sum(expense), net, principal: sum(principal), cashFlow: net - sum(principal) };

  return { year, income, expense, principal, totals, months, pending };
}

/** Years with data, newest first, always including `currentYear`. */
export function availableYears(transactions: Transaction[], currentYear: number): number[] {
  const years = new Set([currentYear, ...transactions.map((t) => Number(t.date.slice(0, 4)))]);
  return [...years].sort((a, b) => b - a);
}
