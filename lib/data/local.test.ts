import { beforeEach, describe, expect, it } from "vitest";
import type { Category, Property, Transaction } from "@/lib/domain/types";
import { createLocalRepository, STORAGE_KEY } from "./local";
import { createMemoryStorage } from "./memory-storage";
import { ConstraintError, NotFoundError, type New, type Repository } from "./repository";
import { createSeedData } from "./seed";

let storage: ReturnType<typeof createMemoryStorage>;
let repo: Repository;
let property: Property;
let rent: Category;

const tx = (overrides: Partial<New<Transaction>> = {}): New<Transaction> => ({
  date: "2026-05-01",
  amount: 95000,
  type: "ingreso",
  categoryId: rent.id,
  propertyId: property.id,
  concept: "Alquiler",
  recurringId: null,
  ...overrides,
});

beforeEach(async () => {
  storage = createMemoryStorage();
  repo = createLocalRepository({ storage });
  property = await repo.createProperty({
    name: "Piso Test",
    address: "Calle Falsa 1",
    purchaseDate: "2020-01-01",
    acquisitionPrice: 10000000,
    constructionPercentage: 60,
    active: true,
  });
  rent = await repo.createCategory({ name: "Alquiler", type: "ingreso", scope: "piso", deductible: false });
});

describe("local repository", () => {
  it("starts empty without initial data", async () => {
    const fresh = createLocalRepository({ storage: createMemoryStorage() });
    expect(await fresh.listTransactions()).toEqual([]);
  });

  it("loads initial data only when storage is empty", async () => {
    const s = createMemoryStorage();
    const seeded = createLocalRepository({ storage: s, initialData: () => createSeedData("2026-11-02") });
    expect((await seeded.listProperties()).length).toBe(2);
    await seeded.replaceAll({ properties: [], categories: [], transactions: [], recurrings: [] });
    const again = createLocalRepository({ storage: s, initialData: () => createSeedData("2026-11-02") });
    expect(await again.listProperties()).toEqual([]);
  });

  it("persists to storage as JSON under the configured key", async () => {
    await repo.createTransaction(tx());
    const other = createLocalRepository({ storage });
    expect(await other.listTransactions()).toHaveLength(1);
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!).transactions).toHaveLength(1);
  });

  it("creates, reads, updates and deletes transactions", async () => {
    const created = await repo.createTransaction(tx());
    expect(created.id).toBeTruthy();
    expect(await repo.getTransaction(created.id)).toEqual(created);

    const updated = await repo.updateTransaction(created.id, { amount: 100000, concept: "Subida" });
    expect(updated).toMatchObject({ id: created.id, amount: 100000, concept: "Subida" });

    await repo.deleteTransaction(created.id);
    expect(await repo.getTransaction(created.id)).toBeNull();
  });

  it("returns copies, so callers cannot mutate stored data", async () => {
    const created = await repo.createTransaction(tx());
    created.amount = 1;
    expect((await repo.getTransaction(created.id))!.amount).toBe(95000);
  });

  it("sorts transactions newest first and filters them", async () => {
    const gasto = await repo.createCategory({ name: "IBI", type: "gasto", scope: "piso", deductible: true });
    await repo.createTransaction(tx({ date: "2026-04-01" }));
    await repo.createTransaction(tx({ date: "2026-05-20", type: "gasto", categoryId: gasto.id, amount: 30000 }));
    await repo.createTransaction(tx({ date: "2026-05-02", propertyId: null }));

    expect((await repo.listTransactions()).map((t) => t.date)).toEqual(["2026-05-20", "2026-05-02", "2026-04-01"]);
    expect(await repo.listTransactions({ month: "2026-05" })).toHaveLength(2);
    expect(await repo.listTransactions({ categoryId: gasto.id })).toHaveLength(1);
    expect(await repo.listTransactions({ propertyId: null })).toHaveLength(1);
    expect(await repo.listTransactions({ propertyId: property.id })).toHaveLength(2);
    expect(await repo.listTransactions({ from: "2026-05-01", to: "2026-05-10" })).toHaveLength(1);
  });

  it("rejects amounts that are not positive integer cents", async () => {
    await expect(repo.createTransaction(tx({ amount: 10.5 }))).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.createTransaction(tx({ amount: 0 }))).rejects.toBeInstanceOf(ConstraintError);
    const created = await repo.createTransaction(tx());
    await expect(repo.updateTransaction(created.id, { amount: -5 })).rejects.toBeInstanceOf(ConstraintError);
    expect((await repo.getTransaction(created.id))!.amount).toBe(95000);
  });

  it("rejects invalid dates and unknown references", async () => {
    await expect(repo.createTransaction(tx({ date: "01/05/2026" }))).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.createTransaction(tx({ categoryId: "nope" }))).rejects.toBeInstanceOf(ConstraintError);
    await expect(repo.createTransaction(tx({ propertyId: "nope" }))).rejects.toBeInstanceOf(ConstraintError);
  });

  it("throws NotFoundError for missing ids", async () => {
    await expect(repo.updateTransaction("nope", { amount: 1 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.deleteProperty("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not delete a category in use", async () => {
    await repo.createTransaction(tx());
    await expect(repo.deleteCategory(rent.id)).rejects.toBeInstanceOf(ConstraintError);
    expect(await repo.listCategories()).toHaveLength(1);
  });

  it("deleting a property removes its transactions and recurrings", async () => {
    await repo.createTransaction(tx());
    await repo.createTransaction(tx({ propertyId: null }));
    await repo.createRecurring({
      concept: "Alquiler", amount: 95000, type: "ingreso", categoryId: rent.id, propertyId: property.id,
      frequency: "mensual", day: 1, startDate: "2026-01-01", endDate: null,
    });
    await repo.deleteProperty(property.id);
    expect(await repo.listTransactions()).toHaveLength(1);
    expect(await repo.listRecurrings()).toEqual([]);
  });

  it("deleting a recurring keeps its generated transactions", async () => {
    const r = await repo.createRecurring({
      concept: "Alquiler", amount: 95000, type: "ingreso", categoryId: rent.id, propertyId: property.id,
      frequency: "mensual", day: 1, startDate: "2026-01-01", endDate: null,
    });
    const t = await repo.createTransaction(tx({ recurringId: r.id }));
    await repo.deleteRecurring(r.id);
    expect((await repo.getTransaction(t.id))!.recurringId).toBeNull();
  });

  it("exports and replaces the full snapshot", async () => {
    await repo.createTransaction(tx());
    const snapshot = await repo.exportSnapshot();
    await repo.replaceAll(createSeedData("2026-11-02"));
    expect((await repo.listProperties()).map((p) => p.name)).not.toContain("Piso Test");
    await repo.replaceAll(snapshot);
    expect(await repo.exportSnapshot()).toEqual(snapshot);
  });
});
