import { mortgageStatus } from "./mortgage";
import { planOf } from "./recurring";
import type { Asset, AssetSnapshot, AssetType, Cents, Id, IsoDate, Portfolio, Property, Recurring } from "./types";

/** Fixed product kinds (shown as «Producto»). */
export const ASSET_KINDS: { value: Asset["kind"]; label: string }[] = [
  { value: "fondo", label: "Fondo" },
  { value: "etf", label: "ETF" },
  { value: "efectivo", label: "Efectivo" },
  { value: "inmobiliario", label: "Inmobiliario" },
];

export interface AssetValuation {
  assetId: Id;
  name: string;
  kind: Asset["kind"];
  /** Latest value up to the date, or null if there is no snapshot. */
  value: Cents | null;
  valueDate: IsoDate | null;
  purchaseValue: Cents | null;
  fiscalCost: Cents | null;
  /** value − purchase value. */
  gain: Cents | null;
  /** value − fiscal cost. */
  fiscalGain: Cents | null;
  /** Outstanding mortgage principal (real estate only). */
  debt: Cents;
}

export interface ValuationContext {
  snapshots: AssetSnapshot[];
  properties: Property[];
  recurrings: Recurring[];
  date: IsoDate;
}

const gainPct = (gain: Cents | null, base: Cents | null) => (gain === null || !base ? null : gain / base);
export { gainPct };

/** Outstanding mortgage principal of a flat at a date. */
export function mortgageDebt(propertyId: Id, recurrings: Recurring[], date: IsoDate): Cents {
  return recurrings
    .filter((r) => r.kind === "hipoteca" && r.mortgage && r.propertyId === propertyId && r.startDate <= date)
    .reduce((s, r) => s + mortgageStatus(planOf(r), r.mortgage!.principal, date, r.mortgage!.adjustments).balance, 0);
}

/**
 * Valuation of an asset at a date from its snapshots. Cash has no gains (purchase = value).
 * Real estate takes purchase value and fiscal cost from the flat (price + purchase costs).
 */
export function valueAsset(asset: Asset, ctx: ValuationContext): AssetValuation {
  const own = ctx.snapshots
    .filter((s) => s.assetId === asset.id && s.date <= ctx.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = own.at(-1) ?? null;
  const property = asset.propertyId ? ctx.properties.find((p) => p.id === asset.propertyId) : undefined;
  let purchaseValue: Cents | null = null;
  let fiscalCost: Cents | null = null;
  for (const s of own) {
    if (s.purchaseValue !== null) purchaseValue = s.purchaseValue;
    if (s.fiscalCost !== null) fiscalCost = s.fiscalCost;
  }
  if (asset.kind === "efectivo") purchaseValue = fiscalCost = latest?.value ?? null;
  if (property) purchaseValue = fiscalCost = property.acquisitionPrice + property.purchaseCosts;
  // Without an explicit fiscal cost it equals the purchase value (no transfers).
  if (fiscalCost === null) fiscalCost = purchaseValue;

  const value = latest?.value ?? null;
  return {
    assetId: asset.id,
    name: property?.name ?? asset.name,
    kind: asset.kind,
    value,
    valueDate: latest?.date ?? null,
    purchaseValue,
    fiscalCost,
    gain: value !== null && purchaseValue !== null ? value - purchaseValue : null,
    fiscalGain: value !== null && fiscalCost !== null ? value - fiscalCost : null,
    debt: property ? mortgageDebt(property.id, ctx.recurrings, ctx.date) : 0,
  };
}

export interface Totals {
  value: Cents;
  purchaseValue: Cents;
  fiscalCost: Cents;
  gain: Cents;
  fiscalGain: Cents;
  debt: Cents;
  /** value − debt. */
  net: Cents;
  /** Assets without any value yet (left out of the totals). */
  missing: number;
}

/** Totals of a set of valuations; assets without value are left out and counted. */
export function sumValuations(items: AssetValuation[]): Totals {
  const t: Totals = { value: 0, purchaseValue: 0, fiscalCost: 0, gain: 0, fiscalGain: 0, debt: 0, net: 0, missing: 0 };
  for (const v of items) {
    if (v.value === null) {
      t.missing += 1;
      continue;
    }
    t.value += v.value;
    t.purchaseValue += v.purchaseValue ?? v.value;
    t.fiscalCost += v.fiscalCost ?? v.value;
    t.gain += v.gain ?? 0;
    t.fiscalGain += v.fiscalGain ?? 0;
    t.debt += v.debt;
  }
  t.net = t.value - t.debt;
  return t;
}

/** Ids of a portfolio and all its descendants. */
export function descendantIds(portfolioId: Id, portfolios: Portfolio[]): Set<Id> {
  const result = new Set<Id>([portfolioId]);
  let added = true;
  while (added) {
    added = false;
    for (const p of portfolios) {
      if (p.parentId && result.has(p.parentId) && !result.has(p.id)) {
        result.add(p.id);
        added = true;
      }
    }
  }
  return result;
}

/** Assets in a portfolio or any of its sub-portfolios, each once. */
export function portfolioAssetIds(portfolioId: Id, portfolios: Portfolio[]): Set<Id> {
  const ids = new Set<Id>();
  for (const p of portfolios) if (descendantIds(portfolioId, portfolios).has(p.id)) p.assetIds.forEach((a) => ids.add(a));
  return ids;
}

export interface PortfolioChild {
  type: "activo" | "cartera";
  id: Id;
  name: string;
  totals: Totals;
  /** Share of the portfolio value (0-1). With overlapping children, shares add up to more than 1. */
  weight: number;
  /** Only for assets. */
  valuation?: AssetValuation;
}

export interface PortfolioView {
  portfolio: Portfolio;
  totals: Totals;
  children: PortfolioChild[];
  /** Some asset is counted in more than one direct child. */
  overlap: boolean;
}

/** Direct children (sub-portfolios first, then assets) with totals and weights. */
export function portfolioView(portfolioId: Id, portfolios: Portfolio[], valuations: Map<Id, AssetValuation>): PortfolioView {
  const portfolio = portfolios.find((p) => p.id === portfolioId)!;
  const valuesOf = (ids: Iterable<Id>) => [...ids].map((id) => valuations.get(id)).filter((v): v is AssetValuation => !!v);
  const totals = sumValuations(valuesOf(portfolioAssetIds(portfolioId, portfolios)));

  const subs = portfolios.filter((p) => p.parentId === portfolioId).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const children: PortfolioChild[] = [];
  const seen = new Map<Id, number>();
  for (const sub of subs) {
    const ids = portfolioAssetIds(sub.id, portfolios);
    ids.forEach((id) => seen.set(id, (seen.get(id) ?? 0) + 1));
    children.push({ type: "cartera", id: sub.id, name: sub.name, totals: sumValuations(valuesOf(ids)), weight: 0 });
  }
  for (const v of valuesOf(portfolio.assetIds).sort((a, b) => a.name.localeCompare(b.name, "es"))) {
    seen.set(v.assetId, (seen.get(v.assetId) ?? 0) + 1);
    children.push({ type: "activo", id: v.assetId, name: v.name, totals: sumValuations([v]), weight: 0, valuation: v });
  }
  for (const c of children) c.weight = totals.value ? c.totals.value / totals.value : 0;
  return { portfolio, totals, children, overlap: [...seen.values()].some((n) => n > 1) };
}

/** Whether `parentId` can be the parent of `portfolioId` (no self or descendant). */
export function canBeParent(portfolioId: Id, parentId: Id | null, portfolios: Portfolio[]): boolean {
  return parentId === null || !descendantIds(portfolioId, portfolios).has(parentId);
}

/** Slice id for assets without a type. */
export const UNTYPED = "__sin-tipo";

export interface AllocationSlice {
  id: Id;
  name: string;
  value: Cents;
  /** Position of the type in the full, name-sorted list: keeps each type's colour stable. `null` = «Sin tipo». */
  colorIndex: number | null;
  icon: string | null;
}

/**
 * Value of the given assets grouped by asset type, in name order, with «Sin tipo» last.
 * Types without value are left out; assets without value don't count.
 */
export function allocationByType(assetIds: Iterable<Id>, assets: Asset[], types: AssetType[], valuations: Map<Id, AssetValuation>): AllocationSlice[] {
  const ordered = [...types].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const typeOf = new Map(assets.map((a) => [a.id, a.assetTypeId]));
  const known = new Set(ordered.map((t) => t.id));
  const totals = new Map<Id, Cents>();
  for (const id of new Set(assetIds)) {
    const value = valuations.get(id)?.value;
    if (!value) continue;
    const typeId = typeOf.get(id);
    const key = typeId && known.has(typeId) ? typeId : UNTYPED;
    totals.set(key, (totals.get(key) ?? 0) + value);
  }
  const slices: AllocationSlice[] = ordered
    .map((t, i) => ({ id: t.id, name: t.name, value: totals.get(t.id) ?? 0, colorIndex: i, icon: t.icon }))
    .filter((s) => s.value > 0);
  const untyped = totals.get(UNTYPED);
  if (untyped) slices.push({ id: UNTYPED, name: "Sin tipo", value: untyped, colorIndex: null, icon: null });
  return slices;
}
