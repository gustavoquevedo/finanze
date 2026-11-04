import type {
  Asset,
  AssetSnapshot,
  AssetType,
  Category,
  Portfolio,
  Property,
  Recurring,
  Snapshot,
  Transaction,
} from "@/lib/domain/types";

/** A database row as PostgREST sends and receives it (snake_case columns). */
export type Row = Record<string, unknown>;

/** Tables in the order parents come before children (inserts go in this order; deletes in reverse). */
export const TABLES = [
  "properties",
  "categories",
  "recurrings",
  "mortgage_adjustments",
  "transactions",
  "asset_types",
  "assets",
  "asset_snapshots",
  "portfolios",
  "portfolio_assets",
] as const;
export type Table = (typeof TABLES)[number];

/** Primary key columns of each table. */
export const KEYS: Record<Table, string[]> = {
  properties: ["id"],
  categories: ["id"],
  recurrings: ["id"],
  mortgage_adjustments: ["recurring_id", "date"],
  transactions: ["id"],
  asset_types: ["id"],
  assets: ["id"],
  asset_snapshots: ["id"],
  portfolios: ["id"],
  portfolio_assets: ["portfolio_id", "asset_id"],
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Snapshot → rows of every table. `user_id` is filled in by the database (default auth.uid()). */
export function toRows(d: Snapshot): Record<Table, Row[]> {
  return {
    properties: d.properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      purchase_date: p.purchaseDate,
      acquisition_price: p.acquisitionPrice,
      purchase_costs: p.purchaseCosts,
      cadastral_value: p.cadastralValue,
      construction_percentage: p.constructionPercentage,
      active: p.active,
    })),
    categories: d.categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      scope: c.scope,
      deductible: c.deductible,
      not_expense: c.notExpense,
      limited_deduction: c.limitedDeduction,
      icon: c.icon,
    })),
    recurrings: d.recurrings.map((r) => ({
      id: r.id,
      kind: r.kind,
      concept: r.concept,
      amount: r.amount,
      type: r.type,
      category_id: r.categoryId,
      property_id: r.propertyId,
      frequency: r.frequency,
      day: r.day,
      start_date: r.startDate,
      end_date: r.endDate,
      generated_until: r.generatedUntil,
      mortgage_principal: r.mortgage?.principal ?? null,
      mortgage_annual_rate: r.mortgage?.annualRate ?? null,
      mortgage_installments: r.mortgage?.installments ?? null,
      mortgage_interest_method: r.mortgage?.interestMethod ?? null,
      mortgage_principal_category_id: r.mortgage?.principalCategoryId ?? null,
    })),
    mortgage_adjustments: d.recurrings.flatMap((r) =>
      (r.mortgage?.adjustments ?? []).map((a) => ({ recurring_id: r.id, date: a.date, balance: a.balance, payment: a.payment })),
    ),
    transactions: d.transactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      type: t.type,
      category_id: t.categoryId,
      property_id: t.propertyId,
      concept: t.concept,
      recurring_id: t.recurringId,
      confirmed: t.confirmed,
    })),
    asset_types: d.assetTypes.map((t) => ({ id: t.id, name: t.name, icon: t.icon })),
    assets: d.assets.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      property_id: a.propertyId,
      asset_type_id: a.assetTypeId,
      daily_use: a.dailyUse,
      active: a.active,
    })),
    asset_snapshots: d.assetSnapshots.map((s) => ({
      id: s.id,
      asset_id: s.assetId,
      date: s.date,
      value: s.value,
      purchase_value: s.purchaseValue,
      fiscal_cost: s.fiscalCost,
    })),
    portfolios: d.portfolios.map((p) => ({ id: p.id, name: p.name, parent_id: p.parentId })),
    portfolio_assets: d.portfolios.flatMap((p) => p.assetIds.map((a) => ({ portfolio_id: p.id, asset_id: a }))),
  };
}

/** Rows of every table → snapshot. Numbers may come as strings (numeric columns). */
export function fromRows(rows: Record<Table, Row[]>): Snapshot {
  const adjustments = new Map<string, Row[]>();
  for (const a of rows.mortgage_adjustments) {
    const list = adjustments.get(a.recurring_id as string) ?? [];
    list.push(a);
    adjustments.set(a.recurring_id as string, list);
  }
  const members = new Map<string, string[]>();
  for (const m of rows.portfolio_assets) {
    const list = members.get(m.portfolio_id as string) ?? [];
    list.push(m.asset_id as string);
    members.set(m.portfolio_id as string, list);
  }
  return {
    properties: rows.properties.map(
      (p): Property => ({
        id: p.id as string,
        name: p.name as string,
        address: p.address as string,
        purchaseDate: p.purchase_date as string,
        acquisitionPrice: Number(p.acquisition_price),
        purchaseCosts: Number(p.purchase_costs),
        cadastralValue: num(p.cadastral_value),
        constructionPercentage: Number(p.construction_percentage),
        active: p.active as boolean,
      }),
    ),
    categories: rows.categories.map(
      (c): Category => ({
        id: c.id as string,
        name: c.name as string,
        type: c.type as Category["type"],
        scope: c.scope as Category["scope"],
        deductible: c.deductible as boolean,
        notExpense: c.not_expense as boolean,
        limitedDeduction: c.limited_deduction as boolean,
        icon: (c.icon as string | null) ?? null,
      }),
    ),
    recurrings: rows.recurrings.map(
      (r): Recurring => ({
        id: r.id as string,
        kind: r.kind as Recurring["kind"],
        concept: r.concept as string,
        amount: Number(r.amount),
        type: r.type as Recurring["type"],
        categoryId: r.category_id as string,
        propertyId: (r.property_id as string | null) ?? null,
        frequency: r.frequency as Recurring["frequency"],
        day: Number(r.day),
        startDate: r.start_date as string,
        endDate: (r.end_date as string | null) ?? null,
        generatedUntil: (r.generated_until as string | null) ?? null,
        mortgage:
          r.kind === "hipoteca"
            ? {
                principal: Number(r.mortgage_principal),
                annualRate: Number(r.mortgage_annual_rate),
                installments: Number(r.mortgage_installments),
                interestMethod: (r.mortgage_interest_method ?? "mensual") as "mensual",
                principalCategoryId: r.mortgage_principal_category_id as string,
                adjustments: (adjustments.get(r.id as string) ?? [])
                  .map((a) => ({ date: a.date as string, balance: num(a.balance), payment: num(a.payment) }))
                  .sort((a, b) => a.date.localeCompare(b.date)),
              }
            : null,
      }),
    ),
    transactions: rows.transactions.map(
      (t): Transaction => ({
        id: t.id as string,
        date: t.date as string,
        amount: Number(t.amount),
        type: t.type as Transaction["type"],
        categoryId: t.category_id as string,
        propertyId: (t.property_id as string | null) ?? null,
        concept: t.concept as string,
        recurringId: (t.recurring_id as string | null) ?? null,
        confirmed: t.confirmed as boolean,
      }),
    ),
    assetTypes: rows.asset_types.map((t): AssetType => ({ id: t.id as string, name: t.name as string, icon: (t.icon as string | null) ?? null })),
    assets: rows.assets.map(
      (a): Asset => ({
        id: a.id as string,
        name: a.name as string,
        kind: a.kind as Asset["kind"],
        propertyId: (a.property_id as string | null) ?? null,
        assetTypeId: (a.asset_type_id as string | null) ?? null,
        dailyUse: (a.daily_use as boolean | null) ?? true,
        active: a.active as boolean,
      }),
    ),
    assetSnapshots: rows.asset_snapshots.map(
      (s): AssetSnapshot => ({
        id: s.id as string,
        assetId: s.asset_id as string,
        date: s.date as string,
        value: Number(s.value),
        purchaseValue: num(s.purchase_value),
        fiscalCost: num(s.fiscal_cost),
      }),
    ),
    portfolios: rows.portfolios.map(
      (p): Portfolio => ({
        id: p.id as string,
        name: p.name as string,
        parentId: (p.parent_id as string | null) ?? null,
        assetIds: members.get(p.id as string) ?? [],
      }),
    ),
  };
}

export interface Changes {
  /** Rows to delete per table, by primary key values (children first). */
  deletes: { table: Table; keys: Row[] }[];
  /** Rows to insert or update per table (parents first). */
  upserts: { table: Table; rows: Row[] }[];
}

const keyOf = (table: Table, row: Row) => KEYS[table].map((k) => String(row[k])).join("|");
const pick = (table: Table, row: Row) => Object.fromEntries(KEYS[table].map((k) => [k, row[k]]));

/** Sub-portfolios after their parent, so a new parent exists before its children are written. */
function portfoliosByDepth(rows: Row[]): Row[] {
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const depth = (r: Row, seen = 0): number => {
    const parent = r.parent_id ? byId.get(r.parent_id as string) : undefined;
    return parent && seen < rows.length ? 1 + depth(parent, seen + 1) : 0;
  };
  return [...rows].sort((a, b) => depth(a) - depth(b));
}

/** Row-level differences between two snapshots. */
export function diffSnapshots(before: Snapshot, after: Snapshot): Changes {
  const a = toRows(before);
  const b = toRows(after);
  const changes: Changes = { deletes: [], upserts: [] };
  for (const table of [...TABLES].reverse()) {
    const next = new Set(b[table].map((r) => keyOf(table, r)));
    const gone = a[table].filter((r) => !next.has(keyOf(table, r))).map((r) => pick(table, r));
    if (gone.length) changes.deletes.push({ table, keys: gone });
  }
  for (const table of TABLES) {
    const prev = new Map(a[table].map((r) => [keyOf(table, r), JSON.stringify(r)]));
    let changed = b[table].filter((r) => prev.get(keyOf(table, r)) !== JSON.stringify(r));
    if (table === "portfolios") changed = portfoliosByDepth(changed);
    if (changed.length) changes.upserts.push({ table, rows: changed });
  }
  return changes;
}
