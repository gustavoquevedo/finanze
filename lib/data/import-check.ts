import { addMonths, dayInMonth } from "@/lib/domain/dates";
import { annuityPayment, installmentsBetween } from "@/lib/domain/mortgage";
import type {
  Asset,
  AssetSnapshot,
  AssetType,
  Category,
  MortgageAdjustment,
  Portfolio,
  Property,
  Recurring,
  Snapshot,
  Transaction,
} from "@/lib/domain/types";
import { isIconId } from "@/lib/icons/catalog";
import { migrateSnapshot } from "./local";

/**
 * Fills optional fields of hand-made or older import files, then validates every record.
 * Errors are in Spanish (UI) and say where the problem is: "Movimiento 3 (tx-1): …".
 */

type Raw = Record<string, unknown>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v: unknown): v is string => typeof v === "string" && ISO.test(v) && !Number.isNaN(Date.parse(v));
const isCents = (v: unknown, min = 0): v is number => typeof v === "number" && Number.isInteger(v) && v >= min;
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const nullable = <T>(v: unknown): T | null => (v === undefined ? null : (v as T | null));

const LABEL: Record<keyof Snapshot, string> = {
  properties: "Piso",
  categories: "Categoría",
  transactions: "Movimiento",
  recurrings: "Recurrente",
  assetTypes: "Tipo de activo",
  assets: "Activo",
  assetSnapshots: "Valor de activo",
  portfolios: "Cartera",
};

export interface CheckResult {
  data: Snapshot;
  errors: string[];
}

/** Defaults for optional fields. `type` of transactions and recurrings comes from the category. */
function normalize(raw: Partial<Record<keyof Snapshot, Raw[]>>): Snapshot {
  const categories: Category[] = (raw.categories ?? []).map((c) => ({
    id: c.id as string,
    name: str(c.name),
    type: c.type as Category["type"],
    scope: (c.scope ?? "piso") as Category["scope"],
    deductible: bool(c.deductible, false),
    notExpense: bool(c.notExpense, false),
    limitedDeduction: bool(c.limitedDeduction, false),
    icon: nullable<string>(c.icon),
  }));
  const typeOf = (categoryId: unknown) => categories.find((c) => c.id === categoryId)?.type;

  const properties: Property[] = (raw.properties ?? []).map((p) => ({
    id: p.id as string,
    name: str(p.name),
    address: str(p.address),
    purchaseDate: p.purchaseDate as string,
    acquisitionPrice: p.acquisitionPrice as number,
    purchaseCosts: (p.purchaseCosts ?? 0) as number,
    cadastralValue: nullable<number>(p.cadastralValue),
    constructionPercentage: p.constructionPercentage as number,
    active: bool(p.active, true),
  }));

  const transactions: Transaction[] = (raw.transactions ?? []).map((t) => ({
    id: t.id as string,
    date: t.date as string,
    amount: t.amount as number,
    type: (t.type ?? typeOf(t.categoryId)) as Transaction["type"],
    categoryId: t.categoryId as string,
    propertyId: nullable<string>(t.propertyId),
    concept: str(t.concept),
    recurringId: nullable<string>(t.recurringId),
    confirmed: bool(t.confirmed, true),
  }));

  const recurrings: Recurring[] = (raw.recurrings ?? []).map((r) => {
    const kind = (r.kind ?? (r.mortgage ? "hipoteca" : "fijo")) as Recurring["kind"];
    const startDate = r.startDate as string;
    const m = r.mortgage as Raw | undefined | null;
    const base = {
      id: r.id as string,
      kind,
      concept: str(r.concept),
      categoryId: r.categoryId as string,
      propertyId: nullable<string>(r.propertyId),
      startDate,
      // Left undefined when missing so migrateSnapshot infers it from the file's transactions.
      generatedUntil: (r.generatedUntil === undefined ? undefined : r.generatedUntil) as string | null,
    };
    if (kind === "hipoteca" && m && isIso(startDate)) {
      // Installments from the last date when not given; payment, day and end date are derived.
      const installments = (m.installments ?? (isIso(r.endDate) ? installmentsBetween(startDate, r.endDate) : undefined)) as number;
      const day = Number(startDate.slice(8, 10));
      return {
        ...base,
        type: "gasto",
        frequency: "mensual",
        day,
        endDate: Number.isInteger(installments) ? dayInMonth(addMonths(startDate.slice(0, 7), installments - 1), day) : null,
        amount: (r.amount ?? (isCents(m.principal, 1) && typeof m.annualRate === "number" ? annuityPayment(m.principal, m.annualRate, installments) : 0)) as number,
        mortgage: {
          principal: m.principal as number,
          annualRate: m.annualRate as number,
          installments,
          interestMethod: (m.interestMethod ?? "mensual") as "mensual",
          principalCategoryId: m.principalCategoryId as string,
          adjustments: ((m.adjustments ?? []) as Raw[]).map((a) => ({
            date: a.date as string,
            balance: nullable<number>(a.balance),
            payment: nullable<number>(a.payment),
          })),
        },
      };
    }
    return {
      ...base,
      type: (r.type ?? typeOf(r.categoryId)) as Recurring["type"],
      amount: r.amount as number,
      frequency: (r.frequency ?? "mensual") as Recurring["frequency"],
      day: (r.day ?? (isIso(startDate) ? Number(startDate.slice(8, 10)) : undefined)) as number,
      endDate: nullable<string>(r.endDate),
      mortgage: null,
    };
  });

  const assetTypes: AssetType[] = (raw.assetTypes ?? []).map((t) => ({ id: t.id as string, name: str(t.name), icon: nullable<string>(t.icon) }));
  const assets: Asset[] = (raw.assets ?? []).map((a) => ({
    id: a.id as string,
    name: str(a.name),
    kind: a.kind as Asset["kind"],
    propertyId: nullable<string>(a.propertyId),
    assetTypeId: nullable<string>(a.assetTypeId),
    dailyUse: bool(a.dailyUse, true),
    active: bool(a.active, true),
  }));
  const assetSnapshots: AssetSnapshot[] = (raw.assetSnapshots ?? []).map((s) => ({
    id: s.id as string,
    assetId: s.assetId as string,
    date: s.date as string,
    value: s.value as number,
    purchaseValue: nullable<number>(s.purchaseValue),
    fiscalCost: nullable<number>(s.fiscalCost),
  }));
  const portfolios: Portfolio[] = (raw.portfolios ?? []).map((p) => ({
    id: p.id as string,
    name: str(p.name),
    parentId: nullable<string>(p.parentId),
    assetIds: Array.isArray(p.assetIds) ? (p.assetIds as string[]) : [],
  }));

  return { properties, categories, transactions, recurrings, assetTypes, assets, assetSnapshots, portfolios };
}

function validate(d: Snapshot): string[] {
  const errors: string[] = [];
  const at = (key: keyof Snapshot, i: number, id: string) => `${LABEL[key]} ${i + 1}${id ? ` (${id})` : ""}`;
  const checkIcon = (where: string, icon: unknown) => {
    if (icon !== null && (typeof icon !== "string" || !isIconId(icon))) {
      errors.push(`${where}: el icono «${String(icon)}» no existe (lista en lib/icons/catalog.ts).`);
    }
  };

  // Unique ids per collection.
  for (const key of Object.keys(LABEL) as (keyof Snapshot)[]) {
    const seen = new Set<string>();
    d[key].forEach((x, i) => {
      if (typeof x.id !== "string" || !x.id) errors.push(`${at(key, i, "")}: falta el id.`);
      else if (seen.has(x.id)) errors.push(`${at(key, i, x.id)}: id repetido.`);
      else seen.add(x.id);
    });
  }
  const categories = new Map(d.categories.map((c) => [c.id, c]));
  const properties = new Set(d.properties.map((p) => p.id));
  const recurrings = new Set(d.recurrings.map((r) => r.id));
  const assets = new Map(d.assets.map((a) => [a.id, a]));
  const portfolios = new Map(d.portfolios.map((p) => [p.id, p]));

  const checkScope = (where: string, categoryId: string, propertyId: string | null) => {
    const c = categories.get(categoryId);
    if (!c) return errors.push(`${where}: la categoría «${categoryId}» no existe.`);
    if (propertyId !== null && !properties.has(propertyId)) errors.push(`${where}: el piso «${propertyId}» no existe.`);
    if (c.scope !== (propertyId ? "piso" : "personal")) {
      errors.push(`${where}: la categoría «${c.name}» es de ámbito ${c.scope}, pero el movimiento es ${propertyId ? "de un piso" : "personal"}.`);
    }
    return c;
  };

  d.properties.forEach((p, i) => {
    const w = at("properties", i, p.id);
    if (!p.name.trim()) errors.push(`${w}: falta el nombre.`);
    if (!isIso(p.purchaseDate)) errors.push(`${w}: purchaseDate debe ser una fecha AAAA-MM-DD.`);
    if (!isCents(p.acquisitionPrice, 1)) errors.push(`${w}: acquisitionPrice debe ser un entero en céntimos mayor que 0.`);
    if (!isCents(p.purchaseCosts)) errors.push(`${w}: purchaseCosts debe ser un entero en céntimos.`);
    if (p.cadastralValue !== null && !isCents(p.cadastralValue)) errors.push(`${w}: cadastralValue debe ser un entero en céntimos o null.`);
    if (typeof p.constructionPercentage !== "number" || p.constructionPercentage <= 0 || p.constructionPercentage > 100) {
      errors.push(`${w}: constructionPercentage debe ser un número entre 0 y 100.`);
    }
  });

  d.categories.forEach((c, i) => {
    const w = at("categories", i, c.id);
    if (!c.name.trim()) errors.push(`${w}: falta el nombre.`);
    if (c.type !== "ingreso" && c.type !== "gasto") errors.push(`${w}: type debe ser "ingreso" o "gasto".`);
    if (c.scope !== "piso" && c.scope !== "personal") errors.push(`${w}: scope debe ser "piso" o "personal".`);
    if (c.notExpense && (c.type !== "gasto" || c.deductible)) errors.push(`${w}: notExpense solo vale para gastos no deducibles.`);
    if (c.limitedDeduction && !c.deductible) errors.push(`${w}: limitedDeduction requiere deductible: true.`);
    checkIcon(w, c.icon);
  });

  d.transactions.forEach((t, i) => {
    const w = at("transactions", i, t.id);
    if (!isIso(t.date)) errors.push(`${w}: date debe ser una fecha AAAA-MM-DD.`);
    if (!isCents(t.amount, 1)) errors.push(`${w}: amount debe ser un entero en céntimos mayor que 0 (950,50 € = 95050).`);
    const c = checkScope(w, t.categoryId, t.propertyId);
    if (typeof c === "object" && t.type !== c.type) errors.push(`${w}: type «${t.type}» no coincide con su categoría («${c.type}»).`);
    if (t.recurringId !== null && !recurrings.has(t.recurringId)) errors.push(`${w}: el recurrente «${t.recurringId}» no existe.`);
  });

  d.recurrings.forEach((r, i) => {
    const w = at("recurrings", i, r.id);
    if (!r.concept.trim()) errors.push(`${w}: falta el concepto.`);
    if (!isIso(r.startDate)) errors.push(`${w}: startDate debe ser una fecha AAAA-MM-DD.`);
    if (r.endDate !== null && !isIso(r.endDate)) errors.push(`${w}: endDate debe ser una fecha AAAA-MM-DD o null.`);
    if (r.endDate !== null && isIso(r.endDate) && isIso(r.startDate) && r.endDate < r.startDate) errors.push(`${w}: endDate es anterior a startDate.`);
    if (r.generatedUntil !== null && !isIso(r.generatedUntil)) errors.push(`${w}: generatedUntil debe ser una fecha AAAA-MM-DD o null.`);
    const c = checkScope(w, r.categoryId, r.propertyId);
    if (r.kind === "hipoteca") {
      const m = r.mortgage;
      if (!m) return errors.push(`${w}: una hipoteca necesita el bloque mortgage.`);
      if (!isCents(m.principal, 1)) errors.push(`${w}: mortgage.principal debe ser un entero en céntimos mayor que 0.`);
      if (typeof m.annualRate !== "number" || m.annualRate < 0 || m.annualRate > 30) errors.push(`${w}: mortgage.annualRate debe ser un % entre 0 y 30.`);
      if (!Number.isInteger(m.installments) || m.installments < 1 || m.installments > 600) {
        errors.push(`${w}: indica mortgage.installments (1-600) o endDate (fecha de la última cuota).`);
      }
      if (!["mensual", "dias365", "dias360"].includes(m.interestMethod)) errors.push(`${w}: mortgage.interestMethod debe ser mensual, dias365 o dias360.`);
      if (!categories.has(m.principalCategoryId)) errors.push(`${w}: la categoría de capital «${m.principalCategoryId}» no existe.`);
      m.adjustments.forEach((a: MortgageAdjustment, j) => {
        const wa = `${w}, ajuste ${j + 1}`;
        if (!isIso(a.date)) errors.push(`${wa}: date debe ser una fecha AAAA-MM-DD.`);
        if (a.balance === null && a.payment === null) errors.push(`${wa}: indica balance, payment o ambos.`);
        if (a.balance !== null && !isCents(a.balance)) errors.push(`${wa}: balance debe ser un entero en céntimos.`);
        if (a.payment !== null && !isCents(a.payment, 1)) errors.push(`${wa}: payment debe ser un entero en céntimos mayor que 0.`);
      });
    } else {
      if (r.kind !== "fijo") errors.push(`${w}: kind debe ser "fijo" o "hipoteca".`);
      if (!isCents(r.amount, 1)) errors.push(`${w}: amount debe ser un entero en céntimos mayor que 0.`);
      if (!["mensual", "trimestral", "anual"].includes(r.frequency)) errors.push(`${w}: frequency debe ser mensual, trimestral o anual.`);
      if (!Number.isInteger(r.day) || r.day < 1 || r.day > 31) errors.push(`${w}: day debe ser un día del mes (1-31).`);
      if (typeof c === "object" && r.type !== c.type) errors.push(`${w}: type «${r.type}» no coincide con su categoría («${c.type}»).`);
    }
  });

  const typeNames = new Set<string>();
  d.assetTypes.forEach((t, i) => {
    const w = at("assetTypes", i, t.id);
    const name = t.name.trim().toLocaleLowerCase("es");
    if (!name) errors.push(`${w}: falta el nombre.`);
    else if (typeNames.has(name)) errors.push(`${w}: nombre repetido.`);
    checkIcon(w, t.icon);
    typeNames.add(name);
  });
  const assetTypes = new Set(d.assetTypes.map((t) => t.id));

  d.assets.forEach((a, i) => {
    const w = at("assets", i, a.id);
    if (a.assetTypeId !== null && !assetTypes.has(a.assetTypeId)) errors.push(`${w}: el tipo de activo «${a.assetTypeId}» no existe.`);
    if (!["fondo", "etf", "efectivo", "inmobiliario"].includes(a.kind)) errors.push(`${w}: kind debe ser fondo, etf, efectivo o inmobiliario.`);
    if (a.kind === "inmobiliario") {
      if (!a.propertyId || !properties.has(a.propertyId)) errors.push(`${w}: un activo inmobiliario necesita propertyId de un piso existente.`);
    } else {
      if (a.propertyId !== null) errors.push(`${w}: solo los activos inmobiliarios llevan propertyId.`);
      if (!a.name.trim()) errors.push(`${w}: falta el nombre.`);
    }
  });
  const linked = d.assets.filter((a) => a.propertyId).map((a) => a.propertyId);
  if (new Set(linked).size !== linked.length) errors.push("Activos: hay dos activos inmobiliarios para el mismo piso.");

  const snapshotKeys = new Set<string>();
  d.assetSnapshots.forEach((s, i) => {
    const w = at("assetSnapshots", i, s.id);
    if (!assets.has(s.assetId)) errors.push(`${w}: el activo «${s.assetId}» no existe.`);
    if (!isIso(s.date)) errors.push(`${w}: date debe ser una fecha AAAA-MM-DD.`);
    if (!isCents(s.value)) errors.push(`${w}: value debe ser un entero en céntimos.`);
    if (s.purchaseValue !== null && !isCents(s.purchaseValue)) errors.push(`${w}: purchaseValue debe ser un entero en céntimos o null.`);
    if (s.fiscalCost !== null && !isCents(s.fiscalCost)) errors.push(`${w}: fiscalCost debe ser un entero en céntimos o null.`);
    const key = `${s.assetId}|${s.date}`;
    if (snapshotKeys.has(key)) errors.push(`${w}: ya hay otro valor de ese activo en esa fecha.`);
    snapshotKeys.add(key);
  });

  d.portfolios.forEach((p, i) => {
    const w = at("portfolios", i, p.id);
    if (!p.name.trim()) errors.push(`${w}: falta el nombre.`);
    for (const a of p.assetIds) if (!assets.has(a)) errors.push(`${w}: el activo «${a}» no existe.`);
    if (p.parentId !== null) {
      if (!portfolios.has(p.parentId)) errors.push(`${w}: la cartera «${p.parentId}» no existe.`);
      // Walk up the parents: coming back to itself is a cycle.
      let cursor: string | null = p.parentId;
      for (let steps = 0; cursor && steps <= d.portfolios.length; steps++) {
        if (cursor === p.id) {
          errors.push(`${w}: está dentro de sí misma (ciclo de carteras).`);
          break;
        }
        cursor = portfolios.get(cursor)?.parentId ?? null;
      }
    }
  });
  return errors;
}

/** Normalizes and validates the `data` block of an import file. */
export function checkImport(raw: Partial<Record<keyof Snapshot, Raw[]>>): CheckResult {
  const data = migrateSnapshot(normalize(raw));
  for (const p of data.portfolios) p.assetIds = [...new Set(p.assetIds)];
  // Never behind the recurring's own transactions in the file, or they would be created again.
  for (const r of data.recurrings) {
    const latest = data.transactions.filter((t) => t.recurringId === r.id).map((t) => t.date).sort().at(-1);
    if (latest && (r.generatedUntil === null || r.generatedUntil < latest)) r.generatedUntil = latest;
  }
  return { data, errors: validate(data) };
}
