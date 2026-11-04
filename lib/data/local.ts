import { addMonths, dayInMonth } from "@/lib/domain/dates";
import { planRecurringGeneration } from "@/lib/domain/recurring";
import type { Asset, AssetType, Category, Id, Portfolio, Recurring, Snapshot, Transaction } from "@/lib/domain/types";
import { newId } from "./ids";
import {
  ConstraintError,
  NotFoundError,
  type New,
  type Patch,
  type Repository,
  type TransactionFilter,
} from "./repository";

/** Minimal subset of the Web Storage API, so tests can pass an in-memory store. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const STORAGE_KEY = "finanze:v1";

/**
 * Where a repository keeps the whole data set. `load` returns a copy the repository may change;
 * `save` stores the changed copy (localStorage writes it whole; Supabase writes only what changed).
 */
export interface SnapshotStore {
  load(): Promise<Snapshot>;
  save(data: Snapshot): Promise<void>;
}

export interface SnapshotRepositoryOptions {
  /** Applied to the data given to `replaceAll` (e.g. turning readable ids into UUIDs). */
  prepareReplace?: (data: Snapshot) => Snapshot;
}

export interface LocalRepositoryOptions {
  storage: KeyValueStorage;
  key?: string;
  /** Data loaded the first time, when storage is empty. */
  initialData?: () => Snapshot;
}

export const emptySnapshot = (): Snapshot => ({
  properties: [],
  categories: [],
  transactions: [],
  recurrings: [],
  assetTypes: [],
  assets: [],
  assetSnapshots: [],
  portfolios: [],
});

const ASSET_KINDS = ["fondo", "etf", "efectivo", "inmobiliario"];

const clone = <T>(value: T): T => structuredClone(value);

function assertCents(amount: unknown): void {
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    throw new ConstraintError(`Amount must be a positive integer of cents: ${String(amount)}`);
  }
}

function assertIsoDate(date: unknown): void {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ConstraintError(`Invalid ISO date: ${String(date)}`);
  }
}

function matches(t: Transaction, f: TransactionFilter): boolean {
  if (f.month && !t.date.startsWith(f.month + "-")) return false;
  if (f.from && t.date < f.from) return false;
  if (f.to && t.date > f.to) return false;
  if (f.propertyId !== undefined && t.propertyId !== f.propertyId) return false;
  if (f.categoryId && t.categoryId !== f.categoryId) return false;
  if (f.confirmed !== undefined && t.confirmed !== f.confirmed) return false;
  return true;
}

/**
 * Fills fields added after data was first stored, so older data keeps working:
 * transactions without `confirmed` are confirmed, and recurrings without `generatedUntil`
 * continue from their latest generated transaction (no duplicates).
 */
export function migrateSnapshot(data: Snapshot): Snapshot {
  const properties = data.properties.map((p) => ({ ...p, purchaseCosts: p.purchaseCosts ?? 0, cadastralValue: p.cadastralValue ?? null }));
  // Flags added later: infer them for the initial categories, by name.
  const categories = data.categories.map((c) => ({
    ...c,
    notExpense: c.notExpense ?? (c.type === "gasto" && /capital hipoteca/i.test(c.name)),
    limitedDeduction: c.limitedDeduction ?? (c.deductible && /^(intereses hipoteca|reparaciones y conservaci[oó]n)$/i.test(c.name)),
  }));
  const transactions = data.transactions.map((t) => ({ ...t, confirmed: t.confirmed ?? true }));
  const recurrings = data.recurrings.map((old): Recurring => {
    const mortgage = old.mortgage
      ? {
          ...old.mortgage,
          interestMethod: old.mortgage.interestMethod ?? "mensual",
          adjustments: old.mortgage.adjustments.map((a) => ({ date: a.date, balance: a.balance ?? null, payment: a.payment ?? null })),
        }
      : null;
    const r = { ...old, kind: old.kind ?? "fijo", mortgage };
    if (r.generatedUntil !== undefined) return r;
    const dates = transactions.filter((t) => t.recurringId === r.id).map((t) => t.date).sort();
    return { ...r, generatedUntil: dates.at(-1) ?? null };
  });
  const assets = (data.assets ?? []).map((a) => ({ ...a, assetTypeId: a.assetTypeId ?? null }));
  return { ...data, assetTypes: data.assetTypes ?? [], assets, properties, categories, transactions, recurrings };
}

/** Removes assets with their snapshots and portfolio memberships. */
function removeAssets(d: Snapshot, ids: Set<Id>): void {
  if (ids.size === 0) return;
  d.assets = d.assets.filter((a) => !ids.has(a.id));
  d.assetSnapshots = d.assetSnapshots.filter((s) => !ids.has(s.assetId));
  for (const p of d.portfolios) p.assetIds = p.assetIds.filter((a) => !ids.has(a));
}

function assertAssetType(d: Snapshot, t: Pick<AssetType, "name">, id?: Id): void {
  const name = t.name.trim();
  if (!name) throw new ConstraintError("Asset type name is required");
  const same = (x: string) => x.trim().toLocaleLowerCase("es") === name.toLocaleLowerCase("es");
  if (d.assetTypes.some((x) => x.id !== id && same(x.name))) throw new ConstraintError("Duplicate asset type name");
}

function assertAsset(d: Snapshot, a: Omit<Asset, "id">): void {
  if (a.assetTypeId !== null && !d.assetTypes.some((t) => t.id === a.assetTypeId)) {
    throw new ConstraintError(`Unknown asset type: ${a.assetTypeId}`);
  }
  if (!a.name.trim()) throw new ConstraintError("Asset name is required");
  if (!ASSET_KINDS.includes(a.kind)) throw new ConstraintError(`Invalid asset kind: ${String(a.kind)}`);
  if ((a.kind === "inmobiliario") !== (a.propertyId !== null)) throw new ConstraintError("Real estate assets come from flats");
  if (a.propertyId && !d.properties.some((p) => p.id === a.propertyId)) throw new ConstraintError(`Unknown property: ${a.propertyId}`);
}

function assertPortfolio(d: Snapshot, p: Portfolio): void {
  if (!p.name.trim()) throw new ConstraintError("Portfolio name is required");
  for (const id of p.assetIds) if (!d.assets.some((a) => a.id === id)) throw new ConstraintError(`Unknown asset: ${id}`);
  if (p.parentId !== null) {
    if (!d.portfolios.some((x) => x.id === p.parentId)) throw new ConstraintError(`Unknown portfolio: ${p.parentId}`);
    // Walk up from the parent: reaching the portfolio itself would make a cycle.
    let cursor: Id | null = p.parentId;
    while (cursor) {
      if (cursor === p.id) throw new ConstraintError("A portfolio cannot be inside itself");
      cursor = d.portfolios.find((x) => x.id === cursor)?.parentId ?? null;
    }
  }
}

function assertCategory(c: Pick<Category, "type" | "deductible" | "notExpense" | "limitedDeduction">): void {
  if (c.notExpense && (c.type !== "gasto" || c.deductible)) throw new ConstraintError("A non-expense must be a non-deductible gasto");
  if (c.limitedDeduction && !c.deductible) throw new ConstraintError("Only deductible categories can count towards the limit");
}

const FREQUENCIES = ["mensual", "trimestral", "anual"];

function assertMortgage(r: Pick<Recurring, "kind" | "mortgage" | "frequency" | "startDate" | "endDate" | "day">): void {
  if (r.kind === "fijo") {
    if (r.mortgage !== null) throw new ConstraintError("Only mortgage recurrings have mortgage terms");
    return;
  }
  const m = r.mortgage;
  if (r.kind !== "hipoteca" || !m) throw new ConstraintError(`Invalid recurring kind: ${String(r.kind)}`);
  if (!Number.isInteger(m.principal) || m.principal <= 0) throw new ConstraintError("Invalid mortgage principal");
  if (!(m.annualRate >= 0 && m.annualRate <= 30)) throw new ConstraintError("Invalid mortgage rate");
  if (!Number.isInteger(m.installments) || m.installments < 1 || m.installments > 600) throw new ConstraintError("Invalid installments");
  if (r.frequency !== "mensual") throw new ConstraintError("Mortgages are monthly");
  if (r.day !== Number(r.startDate.slice(8, 10))) throw new ConstraintError("Mortgage day must match the first installment");
  const last = dayInMonth(addMonths(r.startDate.slice(0, 7), m.installments - 1), r.day);
  if (r.endDate !== last) throw new ConstraintError(`Mortgage end date must be the last installment (${last})`);
  if (!["mensual", "dias365", "dias360"].includes(m.interestMethod)) throw new ConstraintError("Invalid interest method");
  for (const a of m.adjustments) {
    assertIsoDate(a.date);
    if (a.balance === null && a.payment === null) throw new ConstraintError("Adjustment needs a balance or a payment");
    if (a.balance !== null && (!Number.isInteger(a.balance) || a.balance < 0)) throw new ConstraintError("Invalid adjustment balance");
    if (a.payment !== null && (!Number.isInteger(a.payment) || a.payment <= 0)) throw new ConstraintError("Invalid adjustment payment");
  }
}

function assertRecurring(r: Pick<Recurring, "amount" | "startDate" | "endDate" | "day" | "frequency" | "kind" | "mortgage">): void {
  assertMortgage(r);
  assertCents(r.amount);
  assertIsoDate(r.startDate);
  if (r.endDate !== null) {
    assertIsoDate(r.endDate);
    if (r.endDate < r.startDate) throw new ConstraintError("End date is before start date");
  }
  if (!Number.isInteger(r.day) || r.day < 1 || r.day > 31) throw new ConstraintError(`Invalid day: ${r.day}`);
  if (!FREQUENCIES.includes(r.frequency)) throw new ConstraintError(`Invalid frequency: ${r.frequency}`);
}

/** Store for `localStorage` (phase 1): the whole data set as one JSON document. */
export function createLocalStore(options: LocalRepositoryOptions): SnapshotStore {
  const { storage, key = STORAGE_KEY, initialData } = options;
  const write = (data: Snapshot) => storage.setItem(key, JSON.stringify(data));
  return {
    async load() {
      const raw = storage.getItem(key);
      if (raw === null) {
        const data = initialData ? initialData() : emptySnapshot();
        write(data);
        return clone(data);
      }
      try {
        return migrateSnapshot({ ...emptySnapshot(), ...(JSON.parse(raw) as Partial<Snapshot>) });
      } catch {
        throw new Error(`Corrupt data in storage key "${key}"`);
      }
    },
    async save(data) {
      write(data);
    },
  };
}

/** Repository backed by `localStorage` (phase 1). */
export function createLocalRepository(options: LocalRepositoryOptions): Repository {
  return createSnapshotRepository(createLocalStore(options));
}

/**
 * The repository logic (validation, cascades, generation), on top of any store.
 * Changes run one at a time, so concurrent calls can't overwrite each other.
 */
export function createSnapshotRepository(store: SnapshotStore, options: SnapshotRepositoryOptions = {}): Repository {
  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  /** Loads, applies `fn` and saves. Changes are discarded if `fn` throws. */
  function mutate<T>(fn: (data: Snapshot) => T): Promise<T> {
    return exclusive(async () => {
      const data = await store.load();
      const result = fn(data);
      await store.save(data);
      return clone(result);
    });
  }

  async function read<T>(fn: (data: Snapshot) => T): Promise<T> {
    // Wait for pending changes so reads see them.
    await queue;
    return clone(fn(await store.load()));
  }

  function findIndex<T extends { id: Id }>(items: T[], id: Id, entity: string): number {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new NotFoundError(entity, id);
    return index;
  }

  function checkRefs(
    data: Snapshot,
    ref: { categoryId: Id; propertyId: Id | null; recurringId?: Id | null; mortgage?: Recurring["mortgage"] },
  ): void {
    if (ref.mortgage && !data.categories.some((c) => c.id === ref.mortgage!.principalCategoryId)) {
      throw new ConstraintError(`Unknown category: ${ref.mortgage.principalCategoryId}`);
    }
    if (!data.categories.some((c) => c.id === ref.categoryId)) {
      throw new ConstraintError(`Unknown category: ${ref.categoryId}`);
    }
    if (ref.propertyId !== null && !data.properties.some((p) => p.id === ref.propertyId)) {
      throw new ConstraintError(`Unknown property: ${ref.propertyId}`);
    }
    if (ref.recurringId && !data.recurrings.some((r) => r.id === ref.recurringId)) {
      throw new ConstraintError(`Unknown recurring: ${ref.recurringId}`);
    }
  }

  function update<T extends { id: Id }>(items: T[], id: Id, patch: Patch<T>, entity: string): T {
    const index = findIndex(items, id, entity);
    const next = { ...items[index], ...patch, id } as T;
    items[index] = next;
    return next;
  }

  return {
    listProperties: () => read((d) => [...d.properties].sort((a, b) => a.name.localeCompare(b.name, "es"))),
    getProperty: (id) => read((d) => d.properties.find((p) => p.id === id) ?? null),
    createProperty: (input) =>
      mutate((d) => {
        assertIsoDate(input.purchaseDate);
        const property = { ...input, id: newId() };
        d.properties.push(property);
        return property;
      }),
    updateProperty: (id, patch) =>
      mutate((d) => {
        if (patch.purchaseDate !== undefined) assertIsoDate(patch.purchaseDate);
        return update(d.properties, id, patch, "Property");
      }),
    deleteProperty: (id) =>
      mutate((d) => {
        findIndex(d.properties, id, "Property");
        // Same as `on delete cascade` in the SQL schema.
        d.properties = d.properties.filter((p) => p.id !== id);
        d.transactions = d.transactions.filter((t) => t.propertyId !== id);
        d.recurrings = d.recurrings.filter((r) => r.propertyId !== id);
        const gone = new Set(d.assets.filter((a) => a.propertyId === id).map((a) => a.id));
        removeAssets(d, gone);
      }),

    listCategories: () => read((d) => [...d.categories].sort((a, b) => a.name.localeCompare(b.name, "es"))),
    createCategory: (input) =>
      mutate((d) => {
        assertCategory(input);
        const category = { ...input, id: newId() };
        d.categories.push(category);
        return category;
      }),
    updateCategory: (id, patch) =>
      mutate((d) => {
        const current = d.categories[findIndex(d.categories, id, "Category")];
        const changesKind =
          (patch.type !== undefined && patch.type !== current.type) ||
          (patch.scope !== undefined && patch.scope !== current.scope);
        const inUse =
          d.transactions.some((t) => t.categoryId === id) ||
          d.recurrings.some((r) => r.categoryId === id || r.mortgage?.principalCategoryId === id);
        // Transactions take their type and scope from the category, so these can't change once used.
        if (changesKind && inUse) throw new ConstraintError("Cannot change type or scope of a category in use");
        assertCategory({ ...current, ...patch });
        return update(d.categories, id, patch, "Category");
      }),
    deleteCategory: (id) =>
      mutate((d) => {
        findIndex(d.categories, id, "Category");
        const inUse =
          d.transactions.some((t) => t.categoryId === id) ||
          d.recurrings.some((r) => r.categoryId === id || r.mortgage?.principalCategoryId === id);
        if (inUse) throw new ConstraintError("Category is in use");
        d.categories = d.categories.filter((c) => c.id !== id);
      }),

    listTransactions: (filter = {}) =>
      read((d) =>
        d.transactions
          .filter((t) => matches(t, filter))
          .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
      ),
    getTransaction: (id) => read((d) => d.transactions.find((t) => t.id === id) ?? null),
    createTransaction: (input: New<Transaction>) =>
      mutate((d) => {
        assertCents(input.amount);
        assertIsoDate(input.date);
        checkRefs(d, input);
        const transaction = { ...input, id: newId() };
        d.transactions.push(transaction);
        return transaction;
      }),
    updateTransaction: (id, patch) =>
      mutate((d) => {
        const next = { ...d.transactions[findIndex(d.transactions, id, "Transaction")], ...patch };
        assertCents(next.amount);
        assertIsoDate(next.date);
        checkRefs(d, next);
        return update(d.transactions, id, patch, "Transaction");
      }),
    deleteTransaction: (id) =>
      mutate((d) => {
        findIndex(d.transactions, id, "Transaction");
        d.transactions = d.transactions.filter((t) => t.id !== id);
      }),

    listRecurrings: () => read((d) => [...d.recurrings].sort((a, b) => a.concept.localeCompare(b.concept, "es"))),
    createRecurring: (input) =>
      mutate((d) => {
        assertRecurring(input);
        checkRefs(d, input);
        const recurring = { ...input, id: newId() };
        d.recurrings.push(recurring);
        return recurring;
      }),
    updateRecurring: (id, patch) =>
      mutate((d) => {
        const next = { ...d.recurrings[findIndex(d.recurrings, id, "Recurring")], ...patch };
        assertRecurring(next);
        checkRefs(d, next);
        return update(d.recurrings, id, patch, "Recurring");
      }),
    deleteRecurring: (id) =>
      mutate((d) => {
        findIndex(d.recurrings, id, "Recurring");
        d.recurrings = d.recurrings.filter((r) => r.id !== id);
        // Same as `on delete set null`: generated transactions are kept.
        for (const t of d.transactions) if (t.recurringId === id) t.recurringId = null;
      }),

    generateDueTransactions: (today) =>
      exclusive(async () => {
        const data = await store.load();
        const plan = planRecurringGeneration(data.recurrings, today);
        if (plan.generatedUntil.size === 0) return 0;
        for (const t of plan.transactions) data.transactions.push({ ...t, id: newId() });
        for (const r of data.recurrings) r.generatedUntil = plan.generatedUntil.get(r.id) ?? r.generatedUntil;
        await store.save(data);
        return plan.transactions.length;
      }),

    listAssets: () => read((d) => [...d.assets].sort((a, b) => a.name.localeCompare(b.name, "es"))),
    listAssetTypes: () => read((d) => [...d.assetTypes].sort((a, b) => a.name.localeCompare(b.name, "es"))),
    createAssetType: (input) =>
      mutate((d) => {
        assertAssetType(d, input);
        const type = { ...input, name: input.name.trim(), id: newId() };
        d.assetTypes.push(type);
        return type;
      }),
    updateAssetType: (id, patch) =>
      mutate((d) => {
        const current = d.assetTypes[findIndex(d.assetTypes, id, "AssetType")];
        const next = { ...current, ...patch };
        assertAssetType(d, next, id);
        return update(d.assetTypes, id, { ...patch, name: next.name.trim() }, "AssetType");
      }),
    deleteAssetType: (id) =>
      mutate((d) => {
        findIndex(d.assetTypes, id, "AssetType");
        d.assetTypes = d.assetTypes.filter((t) => t.id !== id);
        // Same as `on delete set null` in the SQL schema.
        for (const a of d.assets) if (a.assetTypeId === id) a.assetTypeId = null;
      }),

    createAsset: (input) =>
      mutate((d) => {
        assertAsset(d, input);
        const asset = { ...input, name: input.name.trim(), id: newId() };
        d.assets.push(asset);
        return asset;
      }),
    updateAsset: (id, patch) =>
      mutate((d) => {
        const current = d.assets[findIndex(d.assets, id, "Asset")];
        if (patch.kind !== undefined && patch.kind !== current.kind && (current.propertyId || patch.kind === "inmobiliario")) {
          throw new ConstraintError("Real estate assets come from flats");
        }
        if (patch.propertyId !== undefined && patch.propertyId !== current.propertyId) throw new ConstraintError("Cannot relink an asset");
        if (patch.assetTypeId) assertAsset(d, { ...current, ...patch });
        return update(d.assets, id, patch, "Asset");
      }),
    deleteAsset: (id) =>
      mutate((d) => {
        const asset = d.assets[findIndex(d.assets, id, "Asset")];
        if (asset.propertyId) throw new ConstraintError("Delete the flat to delete its asset");
        removeAssets(d, new Set([id]));
      }),

    listAssetSnapshots: (assetId) =>
      read((d) =>
        d.assetSnapshots.filter((s) => !assetId || s.assetId === assetId).sort((a, b) => a.date.localeCompare(b.date)),
      ),
    saveAssetSnapshot: (input) =>
      mutate((d) => {
        findIndex(d.assets, input.assetId, "Asset");
        assertIsoDate(input.date);
        for (const [key, v] of [["value", input.value], ["purchaseValue", input.purchaseValue], ["fiscalCost", input.fiscalCost]] as const) {
          if (v !== null && (!Number.isInteger(v) || v < 0)) throw new ConstraintError(`Invalid ${key}: ${String(v)}`);
        }
        const existing = d.assetSnapshots.find((s) => s.assetId === input.assetId && s.date === input.date);
        if (existing) {
          Object.assign(existing, input);
          return existing;
        }
        const snapshot = { ...input, id: newId() };
        d.assetSnapshots.push(snapshot);
        return snapshot;
      }),
    deleteAssetSnapshot: (id) =>
      mutate((d) => {
        findIndex(d.assetSnapshots, id, "Snapshot");
        d.assetSnapshots = d.assetSnapshots.filter((s) => s.id !== id);
      }),

    listPortfolios: () => read((d) => [...d.portfolios].sort((a, b) => a.name.localeCompare(b.name, "es"))),
    createPortfolio: (input) =>
      mutate((d) => {
        const portfolio = { ...input, name: input.name.trim(), assetIds: [...new Set(input.assetIds)], id: newId() };
        assertPortfolio(d, portfolio);
        d.portfolios.push(portfolio);
        return portfolio;
      }),
    updatePortfolio: (id, patch) =>
      mutate((d) => {
        const next = { ...d.portfolios[findIndex(d.portfolios, id, "Portfolio")], ...patch, id };
        if (patch.assetIds) next.assetIds = [...new Set(patch.assetIds)];
        assertPortfolio(d, next);
        return update(d.portfolios, id, { ...patch, assetIds: next.assetIds }, "Portfolio");
      }),
    deletePortfolio: (id) =>
      mutate((d) => {
        const portfolio = d.portfolios[findIndex(d.portfolios, id, "Portfolio")];
        for (const p of d.portfolios) if (p.parentId === id) p.parentId = portfolio.parentId;
        d.portfolios = d.portfolios.filter((p) => p.id !== id);
      }),

    syncPropertyAssets: () =>
      exclusive(async () => {
        const data = await store.load();
        const linked = new Set(data.assets.map((a) => a.propertyId));
        const missing = data.properties.filter((p) => !linked.has(p.id));
        if (missing.length === 0) return 0;
        for (const p of missing) {
          data.assets.push({ id: newId(), name: p.name, kind: "inmobiliario", propertyId: p.id, assetTypeId: null, active: true });
        }
        await store.save(data);
        return missing.length;
      }),

    exportSnapshot: () => read((d) => d),
    replaceAll: (snapshot) =>
      mutate((d) => {
        Object.assign(d, clone(options.prepareReplace ? options.prepareReplace(snapshot) : snapshot));
      }),
  };
}
