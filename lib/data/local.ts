import { addMonths, dayInMonth } from "@/lib/domain/dates";
import { planRecurringGeneration } from "@/lib/domain/recurring";
import type { Category, Id, Recurring, Snapshot, Transaction } from "@/lib/domain/types";
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

export interface LocalRepositoryOptions {
  storage: KeyValueStorage;
  key?: string;
  /** Data loaded the first time, when storage is empty. */
  initialData?: () => Snapshot;
}

const emptySnapshot = (): Snapshot => ({
  properties: [],
  categories: [],
  transactions: [],
  recurrings: [],
});

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
    const r = { ...old, kind: old.kind ?? "fijo", mortgage: old.mortgage ?? null };
    if (r.generatedUntil !== undefined) return r;
    const dates = transactions.filter((t) => t.recurringId === r.id).map((t) => t.date).sort();
    return { ...r, generatedUntil: dates.at(-1) ?? null };
  });
  return { ...data, properties, categories, transactions, recurrings };
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
  for (const a of m.adjustments) {
    assertIsoDate(a.date);
    if (!Number.isInteger(a.balance) || a.balance < 0) throw new ConstraintError("Invalid adjustment balance");
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

/** Repository backed by `localStorage` (phase 1). The whole data set is stored as one JSON document. */
export function createLocalRepository(options: LocalRepositoryOptions): Repository {
  const { storage, key = STORAGE_KEY, initialData } = options;

  function load(): Snapshot {
    const raw = storage.getItem(key);
    if (raw === null) {
      const data = initialData ? initialData() : emptySnapshot();
      save(data);
      return data;
    }
    try {
      return migrateSnapshot({ ...emptySnapshot(), ...(JSON.parse(raw) as Partial<Snapshot>) });
    } catch {
      throw new Error(`Corrupt data in storage key "${key}"`);
    }
  }

  function save(data: Snapshot): void {
    storage.setItem(key, JSON.stringify(data));
  }

  /** Loads, applies `fn` and saves. Changes are discarded if `fn` throws. */
  async function mutate<T>(fn: (data: Snapshot) => T): Promise<T> {
    const data = load();
    const result = fn(data);
    save(data);
    return clone(result);
  }

  async function read<T>(fn: (data: Snapshot) => T): Promise<T> {
    return clone(fn(load()));
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

    generateDueTransactions: async (today) => {
      const data = load();
      const plan = planRecurringGeneration(data.recurrings, today);
      if (plan.generatedUntil.size === 0) return 0;
      for (const t of plan.transactions) data.transactions.push({ ...t, id: newId() });
      for (const r of data.recurrings) r.generatedUntil = plan.generatedUntil.get(r.id) ?? r.generatedUntil;
      save(data);
      return plan.transactions.length;
    },

    exportSnapshot: () => read((d) => d),
    replaceAll: (snapshot) =>
      mutate((d) => {
        Object.assign(d, clone(snapshot));
      }),
  };
}
