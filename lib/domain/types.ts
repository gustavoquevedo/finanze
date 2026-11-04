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

export interface Property {
  id: Id;
  name: string;
  address: string;
  purchaseDate: IsoDate;
  acquisitionPrice: Cents;
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
}

/** Full data set, used for seeding, export and restore. */
export interface Snapshot {
  properties: Property[];
  categories: Category[];
  transactions: Transaction[];
  recurrings: Recurring[];
}
