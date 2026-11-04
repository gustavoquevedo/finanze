import type {
  Asset,
  AssetSnapshot,
  AssetType,
  Category,
  Portfolio,
  Id,
  IsoDate,
  Property,
  Recurring,
  Snapshot,
  Transaction,
} from "@/lib/domain/types";

export type New<T extends { id: Id }> = Omit<T, "id">;
export type Patch<T extends { id: Id }> = Partial<Omit<T, "id">>;

export interface TransactionFilter {
  /** `YYYY-MM` */
  month?: string;
  from?: IsoDate;
  to?: IsoDate;
  /** A property id, or `null` for personal transactions only. */
  propertyId?: Id | null;
  categoryId?: Id;
  /** `false` = only pending (automatic, not yet confirmed). */
  confirmed?: boolean;
}

/**
 * Single entry point for reading and writing data.
 * Components must use this interface and never touch storage directly.
 */
export interface Repository {
  listProperties(): Promise<Property[]>;
  getProperty(id: Id): Promise<Property | null>;
  createProperty(input: New<Property>): Promise<Property>;
  updateProperty(id: Id, patch: Patch<Property>): Promise<Property>;
  deleteProperty(id: Id): Promise<void>;

  listCategories(): Promise<Category[]>;
  createCategory(input: New<Category>): Promise<Category>;
  updateCategory(id: Id, patch: Patch<Category>): Promise<Category>;
  deleteCategory(id: Id): Promise<void>;

  /** Sorted by date, newest first. */
  listTransactions(filter?: TransactionFilter): Promise<Transaction[]>;
  getTransaction(id: Id): Promise<Transaction | null>;
  createTransaction(input: New<Transaction>): Promise<Transaction>;
  updateTransaction(id: Id, patch: Patch<Transaction>): Promise<Transaction>;
  deleteTransaction(id: Id): Promise<void>;

  listRecurrings(): Promise<Recurring[]>;
  createRecurring(input: New<Recurring>): Promise<Recurring>;
  updateRecurring(id: Id, patch: Patch<Recurring>): Promise<Recurring>;
  deleteRecurring(id: Id): Promise<void>;

  listAssetTypes(): Promise<AssetType[]>;
  createAssetType(input: New<AssetType>): Promise<AssetType>;
  updateAssetType(id: Id, patch: Patch<AssetType>): Promise<AssetType>;
  /** Its assets become untyped («Sin tipo»). */
  deleteAssetType(id: Id): Promise<void>;

  listAssets(): Promise<Asset[]>;
  createAsset(input: New<Asset>): Promise<Asset>;
  updateAsset(id: Id, patch: Patch<Asset>): Promise<Asset>;
  /** Also deletes its snapshots and removes it from portfolios. Real estate assets go with their flat. */
  deleteAsset(id: Id): Promise<void>;

  /** Sorted by date, oldest first. */
  listAssetSnapshots(assetId?: Id): Promise<AssetSnapshot[]>;
  /** Creates or replaces the asset's snapshot for that date. */
  saveAssetSnapshot(input: New<AssetSnapshot>): Promise<AssetSnapshot>;
  deleteAssetSnapshot(id: Id): Promise<void>;

  listPortfolios(): Promise<Portfolio[]>;
  createPortfolio(input: New<Portfolio>): Promise<Portfolio>;
  updatePortfolio(id: Id, patch: Patch<Portfolio>): Promise<Portfolio>;
  /** Sub-portfolios move up to the deleted portfolio's parent; assets are kept. */
  deletePortfolio(id: Id): Promise<void>;

  /** Creates the real estate asset of every flat that has none. Returns how many were created. */
  syncPropertyAssets(): Promise<number>;

  /**
   * Creates pending transactions for every recurring occurrence due by `today`
   * that has not been generated yet. Returns how many were created.
   */
  generateDueTransactions(today: IsoDate): Promise<number>;

  exportSnapshot(): Promise<Snapshot>;
  /** Replaces all data with the given snapshot. */
  replaceAll(snapshot: Snapshot): Promise<void>;
}

export class NotFoundError extends Error {
  constructor(entity: string, id: Id) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class ConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConstraintError";
  }
}
