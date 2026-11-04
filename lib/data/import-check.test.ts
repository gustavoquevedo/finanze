import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { createLocalRepository } from "./local";
import { createMemoryStorage } from "./memory-storage";

const examplePath = path.resolve(__dirname, "../../public/importacion/ejemplo-copia.json");
const exampleText = readFileSync(examplePath, "utf8");
const example = () => JSON.parse(exampleText);
const errorsOf = (file: unknown) => {
  const r = parseBackup(JSON.stringify(file));
  return r.ok ? "" : r.error;
};

describe("example import file", () => {
  it("is valid and fills the optional fields", () => {
    const r = parseBackup(exampleText);
    if (!r.ok) throw new Error(r.error);
    const { data } = r;
    expect(r.summary).toEqual({ properties: 2, categories: 10, transactions: 11, recurrings: 5, assets: 5, assetSnapshots: 8, portfolios: 4 });

    expect(data.properties[1]).toMatchObject({ address: "", purchaseCosts: 0, cadastralValue: null, active: true });
    expect(data.categories.find((c) => c.id === "cat-alquiler")).toMatchObject({ deductible: false, notExpense: false });
    const minimal = data.transactions.find((t) => t.id === "tx-super-2026-10-17")!;
    expect(minimal).toMatchObject({ type: "gasto", propertyId: null, concept: "", recurringId: null, confirmed: true });

    const mortgage = data.recurrings.find((x) => x.id === "rec-hipoteca-centro")!;
    expect(mortgage).toMatchObject({ amount: 56283, day: 2, frequency: "mensual", endDate: "2044-03-02", type: "gasto" });
    const streaming = data.recurrings.find((x) => x.id === "rec-streaming")!;
    expect(streaming).toMatchObject({ kind: "fijo", frequency: "mensual", day: 15, type: "gasto", generatedUntil: null, mortgage: null });
    expect(data.assetSnapshots.find((s) => s.id === "snap-rv-2026-09")).toMatchObject({ purchaseValue: null, fiscalCost: null });
    expect(data.portfolios.find((p) => p.id === "cartera-rv")!.parentId).toBeNull();
    // Notes (keys starting with _) are dropped.
    expect(JSON.stringify(data)).not.toContain("_nota");
  });

  it("imports into the app, creating the missing flat asset and due transactions", async () => {
    const r = parseBackup(exampleText);
    if (!r.ok) throw new Error(r.error);
    const repo = createLocalRepository({ storage: createMemoryStorage() });
    await repo.replaceAll(r.data);
    expect(await repo.syncPropertyAssets()).toBe(1);
    // Nov 2026: rent is already in the file as pending (not created again), mortgage (day 2: interest + principal); streaming backfilled Sep-Nov (15th).
    await repo.generateDueTransactions("2026-11-20");
    const pending = await repo.listTransactions({ confirmed: false });
    expect(pending.map((t) => t.concept.replace(/cuota \d+/, "cuota N")).sort()).toEqual([
      "Alquiler Piso Centro",
      "Hipoteca Piso Centro · capital cuota N/300",
      "Hipoteca Piso Centro · intereses cuota N/300",
      "Plataforma de streaming",
      "Plataforma de streaming",
      "Plataforma de streaming",
    ]);
  });
});

describe("validation messages", () => {
  it("points to the record and field", () => {
    const f = example();
    f.data.transactions[0].amount = 950.5;
    f.data.transactions[1].date = "01/03/2026";
    f.data.transactions[2].categoryId = "cat-nomina";
    expect(errorsOf(f)).toContain("Movimiento 1 (tx-alquiler-centro-2026-10): amount debe ser un entero en céntimos");
    expect(errorsOf(f)).toContain("Movimiento 2 (tx-ibi-centro-2026): date debe ser una fecha AAAA-MM-DD");
    expect(errorsOf(f)).toContain("es de ámbito personal, pero el movimiento es de un piso");
    expect(errorsOf(f)).toContain("La copia tiene 3 errores");
  });

  it("detects duplicates, missing references and cycles", () => {
    const f = example();
    f.data.categories.push({ ...f.data.categories[0] });
    f.data.assetSnapshots[0].assetId = "nope";
    f.data.portfolios[0].parentId = "cartera-bogle";
    const e = errorsOf(f);
    expect(e).toContain("Categoría 11 (cat-alquiler): id repetido.");
    expect(e).toContain("el activo «nope» no existe");
    expect(e).toContain("ciclo de carteras");
  });

  it("checks mortgages and category flags", () => {
    const f = example();
    const m = f.data.recurrings.find((r: { id: string }) => r.id === "rec-hipoteca-centro");
    delete m.mortgage.installments;
    m.mortgage.adjustments.push({ date: "2026-07-01" });
    f.data.categories[0].limitedDeduction = true;
    const e = errorsOf(f);
    expect(e).toContain("indica mortgage.installments (1-600) o endDate");
    expect(e).toContain("ajuste 2: indica balance, payment o ambos");
    expect(e).toContain("limitedDeduction requiere deductible: true");
  });

  it("infers generatedUntil from the file's own transactions", () => {
    const f = example();
    delete f.data.recurrings.find((r: { id: string }) => r.id === "rec-alquiler-centro").generatedUntil;
    const r = parseBackup(JSON.stringify(f));
    // Latest transaction of that recurring in the file: the pending one on 1 Nov.
    expect(r.ok && r.data.recurrings.find((x) => x.id === "rec-alquiler-centro")!.generatedUntil).toBe("2026-11-01");
  });

  it("never leaves generatedUntil behind the file's transactions (no duplicates)", () => {
    const f = example();
    f.data.recurrings.find((r: { id: string }) => r.id === "rec-alquiler-centro").generatedUntil = "2026-05-31";
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.data.recurrings.find((x) => x.id === "rec-alquiler-centro")!.generatedUntil).toBe("2026-11-01");
  });

  it("accepts the end date instead of the number of installments", () => {
    const f = example();
    const m = f.data.recurrings.find((r: { id: string }) => r.id === "rec-hipoteca-centro");
    delete m.mortgage.installments;
    m.endDate = "2044-03-02";
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.data.recurrings.find((x) => x.id === "rec-hipoteca-centro")!.mortgage!.installments).toBe(300);
  });
});
