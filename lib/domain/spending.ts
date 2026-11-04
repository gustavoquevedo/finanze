import { addMonths, dayInMonth } from "./dates";
import { valueAsset } from "./investments";
import type { Asset, AssetSnapshot, Category, Cents, Id, IsoDate, Transaction } from "./types";

/**
 * Estimated spending that was not recorded, from «spending = income − saving»:
 *
 *   unrecorded = income − recorded expenses − mortgage principal − net contributions − change in cash
 *
 * Cash = month-end balance of everyday cash accounts; contributions = change in the purchase value
 * of funds and ETFs (market gains don't count). Pending transactions count, like in the totals.
 */
export interface MonthSpending {
  /** `YYYY-MM` */
  month: string;
  /** End of the month, or `today` for the current month. */
  end: IsoDate;
  current: boolean;
  income: Cents;
  /** Recorded expenses (without «no es gasto» categories). */
  expenses: Cents;
  /** Of those, personal ones (no flat). */
  personalExpenses: Cents;
  /** «No es gasto» outflows, e.g. mortgage principal. */
  principal: Cents;
  /** Net money put into funds and ETFs. */
  contributions: Cents;
  /** Month-end cash − previous month-end cash (everyday accounts). */
  cashChange: Cents;
  /** principal + contributions + cashChange. */
  saving: Cents;
  /** income − expenses − saving. Not reliable if `missing` has names. */
  unrecorded: Cents;
  /** Recorded personal expenses + unrecorded. */
  personalTotal: Cents;
  /** Everyday accounts without a balance recorded in this month or the previous one. */
  missing: string[];
  /**
   * First month with balances: starting balances and positions are not this month's saving, so
   * the estimate starts the next month.
   */
  trackingStart: boolean;
}

export interface SpendingInput {
  transactions: Transaction[];
  categories: Category[];
  assets: Asset[];
  snapshots: AssetSnapshot[];
}

/** Everyday cash accounts used for the estimate. */
export const everydayAccounts = (assets: Asset[]) => assets.filter((a) => a.kind === "efectivo" && a.dailyUse);

const ctxAt = (input: SpendingInput, date: IsoDate) => ({ snapshots: input.snapshots, properties: [], recurrings: [], date });

/** Last snapshot date of an asset up to `date`. */
function lastValueDate(assetId: Id, snapshots: AssetSnapshot[], date: IsoDate): IsoDate | null {
  let last: IsoDate | null = null;
  for (const s of snapshots) if (s.assetId === assetId && s.date <= date && (!last || s.date > last)) last = s.date;
  return last;
}

/** The estimate for one month (`YYYY-MM`). */
export function monthSpending(input: SpendingInput, month: string, today: IsoDate): MonthSpending {
  const current = month === today.slice(0, 7);
  const end = current ? today : dayInMonth(month, 31);
  const prevMonth = addMonths(month, -1);
  const prevEnd = dayInMonth(prevMonth, 31);
  const byId = new Map(input.categories.map((c) => [c.id, c]));
  // Tracking starts in the first month with any value for cash accounts, funds or ETFs.
  const tracked = new Set(input.assets.filter((a) => a.kind !== "inmobiliario").map((a) => a.id));
  const firstMonth = input.snapshots.filter((s) => tracked.has(s.assetId)).map((s) => s.date.slice(0, 7)).sort()[0];
  const trackingStart = firstMonth === month;

  let income = 0;
  let expenses = 0;
  let personalExpenses = 0;
  let principal = 0;
  for (const t of input.transactions) {
    if (!t.date.startsWith(month + "-") || t.date > end) continue;
    if (t.type === "ingreso") income += t.amount;
    else if (byId.get(t.categoryId)?.notExpense) principal += t.amount;
    else {
      expenses += t.amount;
      if (t.propertyId === null) personalExpenses += t.amount;
    }
  }

  // Contributions: change in purchase value of funds and ETFs (carried forward between values).
  let contributions = 0;
  for (const a of input.assets.filter((x) => x.kind === "fondo" || x.kind === "etf")) {
    const before = valueAsset(a, ctxAt(input, prevEnd)).purchaseValue ?? 0;
    const after = valueAsset(a, ctxAt(input, end)).purchaseValue ?? 0;
    contributions += after - before;
  }

  // Cash: needs a balance recorded in this month and in the previous one for every account.
  let cashChange = 0;
  const missing: string[] = [];
  for (const a of everydayAccounts(input.assets)) {
    const endDate = lastValueDate(a.id, input.snapshots, end);
    const startDate = lastValueDate(a.id, input.snapshots, prevEnd);
    const firstEver = input.snapshots.filter((s) => s.assetId === a.id).map((s) => s.date).sort()[0];
    // An account opened this month starts from 0.
    const opened = firstEver !== undefined && firstEver.startsWith(month + "-");
    if (!endDate || !endDate.startsWith(month + "-") || (!opened && (!startDate || !startDate.startsWith(prevMonth + "-")))) {
      missing.push(a.name);
      continue;
    }
    const after = valueAsset(a, ctxAt(input, end)).value ?? 0;
    const before = opened ? 0 : (valueAsset(a, ctxAt(input, prevEnd)).value ?? 0);
    cashChange += after - before;
  }

  const saving = principal + contributions + cashChange;
  const unrecorded = income - expenses - saving;
  return {
    month,
    end,
    current,
    income,
    expenses,
    personalExpenses,
    principal,
    contributions,
    cashChange,
    saving,
    unrecorded,
    personalTotal: personalExpenses + unrecorded,
    missing,
    trackingStart,
  };
}

/** Whether the estimate can be trusted for this month. */
export const isComputable = (m: MonthSpending) => m.missing.length === 0 && !m.trackingStart;

/** The last `count` months up to the current one, newest first. */
export function spendingByMonth(input: SpendingInput, today: IsoDate, count = 12): MonthSpending[] {
  const thisMonth = today.slice(0, 7);
  return Array.from({ length: count }, (_, i) => monthSpending(input, addMonths(thisMonth, -i), today));
}
