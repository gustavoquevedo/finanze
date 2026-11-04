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

/**
 * Correction from the bank, applied from its date on (after any installment on or before it):
 * - `balance`: real outstanding principal; the payment is recalculated for the remaining term
 *   unless `payment` is also given.
 * - `payment`: the bank's installment amount, kept from then on; interest is computed on the
 *   balance and the rest of the payment is principal.
 * At least one of the two is set.
 */
export interface MortgageAdjustment {
  date: IsoDate;
  balance: Cents | null;
  payment: Cents | null;
}

/**
 * How monthly interest is computed: `mensual` = balance × TIN / 12; `dias365` / `dias360` =
 * balance × TIN × days since the previous installment / 365 (or 360).
 */
export type InterestMethod = "mensual" | "dias365" | "dias360";

export interface MortgageTerms {
  /** Initial loan principal. */
  principal: Cents;
  /** Fixed nominal annual rate (TIN), in percent, e.g. 2.9. */
  annualRate: number;
  /** Total number of monthly installments. */
  installments: number;
  interestMethod: InterestMethod;
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
  /** Icon id from the catalogue (lib/icons/catalog.ts), or `null`. */
  icon: string | null;
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

/** Product kind: fixed, it decides behaviour (cash has no gains; real estate comes from a flat). Shown as «Producto». */
export type AssetKind = "fondo" | "etf" | "efectivo" | "inmobiliario";

/** User-defined classification of assets (e.g. «Renta variable»), used for allocation charts. */
export interface AssetType {
  id: Id;
  name: string;
  /** Icon id from the catalogue (lib/icons/catalog.ts), or `null`. */
  icon: string | null;
}

export interface Asset {
  id: Id;
  /** For real estate, the flat's name is shown instead. */
  name: string;
  kind: AssetKind;
  /** Real estate assets are created automatically from a flat. */
  propertyId: Id | null;
  /** User-defined type, or `null` = «Sin tipo». */
  assetTypeId: Id | null;
  active: boolean;
}

/**
 * Value of an asset at a date. Purchase value and fiscal cost are optional: when missing, the
 * previous snapshot's are kept (they change with contributions, sales or transfers).
 */
export interface AssetSnapshot {
  id: Id;
  assetId: Id;
  date: IsoDate;
  value: Cents;
  /** What was paid for what is held now. */
  purchaseValue: Cents | null;
  /** Acquisition value for tax purposes: kept across fund transfers (traspasos). */
  fiscalCost: Cents | null;
}

/**
 * Group of assets. An asset can be in several portfolios; a portfolio has at most one parent.
 * A portfolio's value counts each asset in it or in its sub-portfolios once.
 */
export interface Portfolio {
  id: Id;
  name: string;
  parentId: Id | null;
  assetIds: Id[];
}

/** Full data set, used for seeding, export and restore. */
export interface Snapshot {
  properties: Property[];
  categories: Category[];
  transactions: Transaction[];
  recurrings: Recurring[];
  assetTypes: AssetType[];
  assets: Asset[];
  assetSnapshots: AssetSnapshot[];
  portfolios: Portfolio[];
}
