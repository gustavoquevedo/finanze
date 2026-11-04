import type { SupabaseClient } from "@supabase/supabase-js";
import type { Db } from "./supabase-store";
import { KEYS, type Row, type Table } from "./supabase-rows";

const PAGE = 1000; // PostgREST returns at most 1000 rows per request by default.
const CHUNK = 200;

const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`Supabase (${what}): ${error.message}`);
}

/** Db operations over supabase-js. RLS limits every query to the signed-in user's rows. */
export function createSupabaseDb(client: SupabaseClient): Db {
  return {
    async selectAll(table: Table) {
      const rows: Row[] = [];
      const [first] = KEYS[table];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client.from(table).select("*").order(first).range(from, from + PAGE - 1);
        check(error, `leer ${table}`);
        rows.push(...((data ?? []) as Row[]));
        if (!data || data.length < PAGE) return rows;
      }
    },
    async upsert(table: Table, rows: Row[]) {
      for (const part of chunks(rows, CHUNK)) {
        const { error } = await client.from(table).upsert(part, { onConflict: KEYS[table].join(",") });
        check(error, `guardar ${table}`);
      }
    },
    async delete(table: Table, keys: Row[]) {
      const [a, b] = KEYS[table];
      if (!b) {
        for (const part of chunks(keys.map((k) => k[a] as string), CHUNK)) {
          const { error } = await client.from(table).delete().in(a, part);
          check(error, `borrar ${table}`);
        }
        return;
      }
      // Composite key: group by the first column.
      const groups = new Map<string, string[]>();
      for (const k of keys) groups.set(String(k[a]), [...(groups.get(String(k[a])) ?? []), String(k[b])]);
      for (const [value, others] of groups) {
        for (const part of chunks(others, CHUNK)) {
          const { error } = await client.from(table).delete().eq(a, value).in(b, part);
          check(error, `borrar ${table}`);
        }
      }
    },
  };
}
