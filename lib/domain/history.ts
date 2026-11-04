import { addMonths, dayInMonth } from "./dates";
import {
  allocationByType,
  portfolioAssetIds,
  portfolioView,
  sumValuations,
  valueAsset,
  type AssetValuation,
  type Totals,
  type ValuationContext,
} from "./investments";
import type { Asset, AssetType, Cents, Id, IsoDate, Portfolio } from "./types";

/**
 * Month ends from `from`'s month to `to`'s month; the last point is `to` itself (so the current
 * month shows today's value). At most `limit` points (the most recent).
 */
export function monthEnds(from: IsoDate, to: IsoDate, limit = 120): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) {
    const end = dayInMonth(m, 31);
    dates.push(end < to ? end : to);
  }
  return dates.slice(-limit);
}

/** First snapshot date among the given assets, or null if none has values. */
export function firstValueDate(assetIds: Iterable<Id>, ctx: Pick<ValuationContext, "snapshots">): IsoDate | null {
  const ids = new Set(assetIds);
  const dates = ctx.snapshots.filter((s) => ids.has(s.assetId)).map((s) => s.date).sort();
  return dates[0] ?? null;
}

/** Valuation of every asset at each date (carrying each asset's last value forward). */
export function valuationsOverTime(assets: Asset[], ctx: Omit<ValuationContext, "date">, dates: IsoDate[]): Map<Id, AssetValuation>[] {
  return dates.map((date) => new Map(assets.map((a) => [a.id, valueAsset(a, { ...ctx, date })])));
}

export interface Series {
  id: Id;
  name: string;
  /** Fixed colour slot (stable across charts); `null` = uncategorised. */
  colorIndex: number | null;
  icon?: string | null;
  values: Cents[];
}

export interface History {
  dates: IsoDate[];
  /** Totals of the whole set at each date. */
  totals: Totals[];
  /** Parts to stack, one value per date. */
  series: Series[];
  /** Parts share assets, so stacking them adds more than the total. */
  overlap: boolean;
}

/** One asset over time. */
export function assetHistory(assetId: Id, perDate: Map<Id, AssetValuation>[], dates: IsoDate[]): { dates: IsoDate[]; points: AssetValuation[] } {
  return { dates, points: perDate.map((m) => m.get(assetId)!) };
}

/**
 * A portfolio over time, stacked by its direct children (sub-portfolios, then assets, as in the
 * portfolio view). Uses the current composition for every date.
 */
export function portfolioHistory(portfolioId: Id, portfolios: Portfolio[], perDate: Map<Id, AssetValuation>[], dates: IsoDate[]): History {
  const views = perDate.map((valuations) => portfolioView(portfolioId, portfolios, valuations));
  const children = views[views.length - 1]?.children ?? [];
  return {
    dates,
    totals: views.map((v) => v.totals),
    series: children.map((c, i) => ({
      id: c.id,
      name: c.name,
      colorIndex: i,
      values: views.map((v) => v.children.find((x) => x.id === c.id)?.totals.value ?? 0),
    })),
    overlap: views.some((v) => v.overlap),
  };
}

/** A set of assets over time, stacked by asset type («Sin tipo» last). */
export function typeHistory(
  assetIds: Id[],
  assets: Asset[],
  types: AssetType[],
  perDate: Map<Id, AssetValuation>[],
  dates: IsoDate[],
): History {
  const ids = new Set(assetIds);
  const byDate = perDate.map((valuations) => allocationByType(ids, assets, types, valuations));
  // Every type that has value at some date, in the stable order allocationByType uses.
  const seen = new Map<Id, { name: string; colorIndex: number | null; icon: string | null }>();
  for (const slices of byDate) for (const s of slices) seen.set(s.id, { name: s.name, colorIndex: s.colorIndex, icon: s.icon });
  const order = [...seen.entries()].sort(([, a], [, b]) => (a.colorIndex ?? Infinity) - (b.colorIndex ?? Infinity));
  return {
    dates,
    totals: perDate.map((valuations) => sumValuations([...ids].map((id) => valuations.get(id)!).filter(Boolean))),
    series: order.map(([id, s]) => ({ id, ...s, values: byDate.map((slices) => slices.find((x) => x.id === id)?.value ?? 0) })),
    overlap: false,
  };
}

/** Assets of a portfolio (for first-date lookups). */
export const assetsOfPortfolio = (portfolioId: Id, portfolios: Portfolio[]) => [...portfolioAssetIds(portfolioId, portfolios)];
