/**
 * Domain types. They mirror the SQL schema in `supabase/schema.sql`.
 * Amounts are always integer cents. Dates are ISO strings (`YYYY-MM-DD`).
 */

export type Id = string;
/** Integer amount in euro cents. Always positive; the sign comes from `TransactionType`. */
export type Cents = number;
/** ISO date, `YYYY-MM-DD`. */
export type IsoDate = string;

export type TransactionType = "ingreso" | "gasto";
export type CategoryScope = "personal" | "piso";
export type Frequency = "mensual" | "trimestral" | "anual";
/** `fijo`: same amount each time. `hipoteca`: French-system mortgage split into interest and principal. */
export type RecurringKind = "fijo" | "hipoteca";

/** Real outstanding principal at a date (from the bank); the schedule is recalculated from there. */
export interface MortgageAdjustment {
  date: IsoDate;
  balance: Cents;
}

export interface MortgageTerms {
  /** Initial loan principal. */
  principal: Cents;
  /** Fixed nominal annual rate (TIN), in percent, e.g. 2.9. */
  annualRate: number;
  /** Total number of monthly installments. */
  installments: number;
  /** Category for the principal part (the recurring's `categoryId` is for the interest). */
  principalCategoryId: Id;
  adjustments: MortgageAdjustment[];
}

export interface Property {
  id: Id;
  name: string;
  address: string;
  purchaseDate: IsoDate;
  acquisitionPrice: Cents;
  /** Purchase costs and taxes (notary, registry, ITP/IVA…). Part of the acquisition cost for tax depreciation. */
  purchaseCosts: Cents;
  /** Total cadastral value (IBI receipt), or `null` if unknown. */
  cadastralValue: Cents | null;
  /** Share (0-100) of the cadastral value that belongs to the building, used for depreciation. */
  constructionPercentage: number;
  active: boolean;
}

export interface Category {
  id: Id;
  name: string;
  type: TransactionType;
  scope: CategoryScope;
  /** Deductible in the Spanish income tax return (Renta). */
  deductible: boolean;
  /**
   * Money out that is not an expense (e.g. mortgage principal): excluded from expenses and net,
   * shown apart and included in cash flow. Only for `gasto`; never deductible.
   */
  notExpense: boolean;
  /**
   * Deductible expense subject to the Renta limit: interest plus repairs and maintenance
   * cannot exceed the rental income (the excess carries over 4 years).
   */
  limitedDeduction: boolean;
}

export interface Transaction {
  id: Id;
  date: IsoDate;
  amount: Cents;
  type: TransactionType;
  categoryId: Id;
  /** `null` means a personal transaction. */
  propertyId: Id | null;
  concept: string;
  /** Recurring rule that generated this transaction, if any. */
  recurringId: Id | null;
  /**
   * `false` while an automatically generated transaction is pending confirmation.
   * Pending transactions already count in totals. Manual transactions are always confirmed.
   */
  confirmed: boolean;
}

export interface Recurring {
  id: Id;
  kind: RecurringKind;
  concept: string;
  amount: Cents;
  type: TransactionType;
  categoryId: Id;
  propertyId: Id | null;
  frequency: Frequency;
  /** Day of the month (1-31) on which it is charged; clamped to the month's last day. */
  day: number;
  /**
   * First occurrence. Its month anchors quarterly and yearly rules
   * (e.g. yearly from 2026-03-01 → every 1 March).
   */
  startDate: IsoDate;
  endDate: IsoDate | null;
  /** Occurrences up to this date have already been generated (so deleted ones are not recreated). */
  generatedUntil: IsoDate | null;
  /**
   * Only for `hipoteca`: then frequency is monthly, `startDate`/`endDate` are the first and last
   * installments, `categoryId` is the interest category and `amount` is the initial installment.
   */
  mortgage: MortgageTerms | null;
}

/** Full data set, used for seeding, export and restore. */
export interface Snapshot {
  properties: Property[];
  categories: Category[];
  transactions: Transaction[];
  recurrings: Recurring[];
}
