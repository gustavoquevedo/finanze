import type { Snapshot } from "@/lib/domain/types";
import { newId } from "./ids";
import { fold } from "@/lib/option-search";

export interface MergeResult {
  data: Snapshot;
  /** Records added from the file. */
  added: Record<keyof Snapshot, number>;
  /** Categories and asset types already present (same name), reused instead of duplicated. */
  reused: { categories: number; assetTypes: number };
}

/**
 * Adds the records of `incoming` to `current` without deleting anything. Every added record gets
 * a new id (so nothing collides); categories (same name, scope and type) and asset types (same
 * name) that already exist are reused, and get the file's icon if they have none.
 */
export function mergeSnapshot(current: Snapshot, incoming: Snapshot): MergeResult {
  const data: Snapshot = structuredClone(current);
  const added = Object.fromEntries(Object.keys(data).map((k) => [k, 0])) as MergeResult["added"];
  const reused = { categories: 0, assetTypes: 0 };
  const ids: Record<string, Map<string, string>> = {};
  const map = (collection: string, from: string, to: string) => (ids[collection] ??= new Map()).set(from, to);
  const ref = (collection: string, id: string) => ids[collection]?.get(id) ?? id;
  const refOrNull = (collection: string, id: string | null) => (id === null ? null : ref(collection, id));

  const categoryKey = (c: { name: string; scope: string; type: string }) => `${c.scope}|${c.type}|${fold(c.name.trim())}`;
  const existingCategories = new Map(data.categories.map((c) => [categoryKey(c), c]));
  for (const c of incoming.categories) {
    const same = existingCategories.get(categoryKey(c));
    if (same) {
      map("categories", c.id, same.id);
      if (!same.icon && c.icon) same.icon = c.icon;
      reused.categories += 1;
    } else {
      const copy = { ...c, id: newId() };
      map("categories", c.id, copy.id);
      data.categories.push(copy);
      existingCategories.set(categoryKey(copy), copy);
      added.categories += 1;
    }
  }

  const existingTypes = new Map(data.assetTypes.map((t) => [fold(t.name.trim()), t]));
  for (const t of incoming.assetTypes) {
    const same = existingTypes.get(fold(t.name.trim()));
    if (same) {
      map("assetTypes", t.id, same.id);
      if (!same.icon && t.icon) same.icon = t.icon;
      reused.assetTypes += 1;
    } else {
      const copy = { ...t, id: newId() };
      map("assetTypes", t.id, copy.id);
      data.assetTypes.push(copy);
      existingTypes.set(fold(copy.name.trim()), copy);
      added.assetTypes += 1;
    }
  }

  // Everything else is added with new ids; first assign them so references resolve in any order.
  for (const key of ["properties", "recurrings", "transactions", "assets", "assetSnapshots", "portfolios"] as const) {
    for (const x of incoming[key]) map(key, x.id, newId());
  }
  data.properties.push(...incoming.properties.map((p) => ({ ...p, id: ref("properties", p.id) })));
  data.recurrings.push(
    ...incoming.recurrings.map((r) => ({
      ...r,
      id: ref("recurrings", r.id),
      categoryId: ref("categories", r.categoryId),
      propertyId: refOrNull("properties", r.propertyId),
      mortgage: r.mortgage ? { ...r.mortgage, principalCategoryId: ref("categories", r.mortgage.principalCategoryId) } : null,
    })),
  );
  data.transactions.push(
    ...incoming.transactions.map((t) => ({
      ...t,
      id: ref("transactions", t.id),
      categoryId: ref("categories", t.categoryId),
      propertyId: refOrNull("properties", t.propertyId),
      recurringId: refOrNull("recurrings", t.recurringId),
    })),
  );
  data.assets.push(
    ...incoming.assets.map((a) => ({
      ...a,
      id: ref("assets", a.id),
      propertyId: refOrNull("properties", a.propertyId),
      assetTypeId: refOrNull("assetTypes", a.assetTypeId),
    })),
  );
  data.assetSnapshots.push(...incoming.assetSnapshots.map((s) => ({ ...s, id: ref("assetSnapshots", s.id), assetId: ref("assets", s.assetId) })));
  data.portfolios.push(
    ...incoming.portfolios.map((p) => ({
      ...p,
      id: ref("portfolios", p.id),
      parentId: refOrNull("portfolios", p.parentId),
      assetIds: p.assetIds.map((a) => ref("assets", a)),
    })),
  );
  for (const key of ["properties", "recurrings", "transactions", "assets", "assetSnapshots", "portfolios"] as const) {
    added[key] = incoming[key].length;
  }
  return { data, added, reused };
}
