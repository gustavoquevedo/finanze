import { todayIso } from "@/lib/domain/dates";
import { firstValueDate, monthEnds, valuationsOverTime } from "@/lib/domain/history";
import type { Asset, AssetSnapshot, Property, Recurring } from "@/lib/domain/types";

interface Inputs {
  assets: Asset[];
  snapshots: AssetSnapshot[];
  properties: Property[];
  recurrings: Recurring[];
}

/**
 * Month-end dates from the first value of `assetIds` to today, and every asset's valuation at
 * each of them. Empty when there are no values yet.
 */
export function historyFor(assetIds: string[], inv: Inputs, today: string = todayIso()) {
  const ctx = { snapshots: inv.snapshots, properties: inv.properties, recurrings: inv.recurrings };
  const first = firstValueDate(assetIds, ctx);
  const dates = first ? monthEnds(first, today) : [];
  return { dates, perDate: valuationsOverTime(inv.assets, ctx, dates) };
}

/** Slices every series' values to the visible range. */
export const sliceValues = <T extends { values: (number | null)[] }>(series: T[], from: number) =>
  series.map((s) => ({ ...s, values: s.values.slice(from) }));
