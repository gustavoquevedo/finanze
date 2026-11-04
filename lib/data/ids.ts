import type { Snapshot } from "@/lib/domain/types";

/** UUID v4. Falls back to Math.random where `crypto.randomUUID` is unavailable (e.g. plain http on a LAN). */
export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string) => UUID.test(id);

/**
 * Replaces ids that are not UUIDs (e.g. "piso-centro" from a hand-made import file) with new
 * UUIDs, updating every reference. Ids are unique per collection, so each collection has its
 * own map. Returns a new object; UUIDs are kept.
 */
export function remapIds(data: Snapshot): Snapshot {
  const maps = new Map<string, Map<string, string>>();
  const mapFor = (collection: string) => {
    if (!maps.has(collection)) maps.set(collection, new Map());
    return maps.get(collection)!;
  };
  const own = (collection: string, id: string) => {
    if (isUuid(id)) return id;
    const m = mapFor(collection);
    if (!m.has(id)) m.set(id, newId());
    return m.get(id)!;
  };
  // References are resolved after every own id has been mapped.
  const ref = (collection: string, id: string) => (isUuid(id) ? id : (maps.get(collection)?.get(id) ?? id));
  const refOrNull = (collection: string, id: string | null) => (id === null ? null : ref(collection, id));

  const ids = {
    properties: data.properties.map((x) => own("properties", x.id)),
    categories: data.categories.map((x) => own("categories", x.id)),
    recurrings: data.recurrings.map((x) => own("recurrings", x.id)),
    transactions: data.transactions.map((x) => own("transactions", x.id)),
    assetTypes: data.assetTypes.map((x) => own("assetTypes", x.id)),
    assets: data.assets.map((x) => own("assets", x.id)),
    assetSnapshots: data.assetSnapshots.map((x) => own("assetSnapshots", x.id)),
    portfolios: data.portfolios.map((x) => own("portfolios", x.id)),
  };
  return {
    properties: data.properties.map((p, i) => ({ ...p, id: ids.properties[i] })),
    categories: data.categories.map((c, i) => ({ ...c, id: ids.categories[i] })),
    recurrings: data.recurrings.map((r, i) => ({
      ...r,
      id: ids.recurrings[i],
      categoryId: ref("categories", r.categoryId),
      propertyId: refOrNull("properties", r.propertyId),
      mortgage: r.mortgage ? { ...r.mortgage, principalCategoryId: ref("categories", r.mortgage.principalCategoryId) } : null,
    })),
    transactions: data.transactions.map((t, i) => ({
      ...t,
      id: ids.transactions[i],
      categoryId: ref("categories", t.categoryId),
      propertyId: refOrNull("properties", t.propertyId),
      recurringId: refOrNull("recurrings", t.recurringId),
    })),
    assetTypes: data.assetTypes.map((t, i) => ({ ...t, id: ids.assetTypes[i] })),
    assets: data.assets.map((a, i) => ({
      ...a,
      id: ids.assets[i],
      propertyId: refOrNull("properties", a.propertyId),
      assetTypeId: refOrNull("assetTypes", a.assetTypeId),
    })),
    assetSnapshots: data.assetSnapshots.map((s, i) => ({ ...s, id: ids.assetSnapshots[i], assetId: ref("assets", s.assetId) })),
    portfolios: data.portfolios.map((p, i) => ({
      ...p,
      id: ids.portfolios[i],
      parentId: refOrNull("portfolios", p.parentId),
      assetIds: p.assetIds.map((a) => ref("assets", a)),
    })),
  };
}
