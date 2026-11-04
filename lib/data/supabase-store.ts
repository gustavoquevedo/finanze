import type { Snapshot } from "@/lib/domain/types";
import { migrateSnapshot, type SnapshotStore } from "./local";
import { diffSnapshots, fromRows, KEYS, TABLES, type Row, type Table } from "./supabase-rows";

/** The few database operations the store needs (implemented with supabase-js, or in memory for tests). */
export interface Db {
  /** Every row of the table visible to the user (RLS). */
  selectAll(table: Table): Promise<Row[]>;
  /** Insert or update by primary key. */
  upsert(table: Table, rows: Row[]): Promise<void>;
  /** Delete by primary key values. */
  delete(table: Table, keys: Row[]): Promise<void>;
}

export interface SupabaseStoreOptions {
  /** Data older than this is reloaded (another device may have changed it). Default 30 s. */
  maxAgeMs?: number;
  now?: () => number;
}

export interface SupabaseStore extends SnapshotStore {
  /** Forget the cached data, so the next read reloads it. */
  invalidate(): void;
}

const clone = <T>(v: T): T => structuredClone(v);

/**
 * Store on Supabase tables. Keeps the data in memory for reads and writes only the rows that
 * changed, deleting children first and inserting parents first so foreign keys always hold.
 */
export function createSupabaseStore(db: Db, options: SupabaseStoreOptions = {}): SupabaseStore {
  const { maxAgeMs = 30_000, now = Date.now } = options;
  let cache: Snapshot | null = null;
  let loadedAt = 0;
  let loading: Promise<Snapshot> | null = null;

  async function fetchAll(): Promise<Snapshot> {
    const entries = await Promise.all(TABLES.map(async (t) => [t, await db.selectAll(t)] as const));
    return migrateSnapshot(fromRows(Object.fromEntries(entries) as Record<Table, Row[]>));
  }

  return {
    async load() {
      if (!cache || now() - loadedAt > maxAgeMs) {
        // One request in flight even if several pages ask at once.
        loading ??= fetchAll().finally(() => (loading = null));
        cache = await loading;
        loadedAt = now();
      }
      return clone(cache);
    },
    async save(next) {
      const before = cache ?? (await fetchAll());
      const { deletes, upserts } = diffSnapshots(before, next);
      try {
        for (const d of deletes) await db.delete(d.table, d.keys);
        for (const u of upserts) await db.upsert(u.table, u.rows);
      } catch (e) {
        // Partly written: reload on next read so the app shows what is really stored.
        cache = null;
        throw e;
      }
      cache = clone(next);
      loadedAt = now();
    },
    invalidate() {
      cache = null;
    },
  };
}

/** In-memory Db with primary keys (for tests). */
export function createMemoryDb(): Db & { tables: Record<Table, Row[]> } {
  const tables = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]])) as Record<Table, Row[]>;
  const key = (t: Table, r: Row) => KEYS[t].map((k) => String(r[k])).join("|");
  return {
    tables,
    async selectAll(t) {
      return clone(tables[t]);
    },
    async upsert(t, rows) {
      for (const r of rows) {
        const i = tables[t].findIndex((x) => key(t, x) === key(t, r));
        if (i === -1) tables[t].push(clone(r));
        else tables[t][i] = clone(r);
      }
    },
    async delete(t, keys) {
      const gone = new Set(keys.map((k) => key(t, k)));
      tables[t] = tables[t].filter((r) => !gone.has(key(t, r)));
    },
  };
}
