import { todayIso } from "@/lib/domain/dates";
import type { Snapshot } from "@/lib/domain/types";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { backupFileName, createBackup, summarize, type BackupSummary } from "./backup";
import { remapIds } from "./ids";
import { createLocalRepository, createLocalStore, createSnapshotRepository, emptySnapshot, STORAGE_KEY } from "./local";
import type { Repository } from "./repository";
import { createSeedData } from "./seed";
import { createSupabaseDb } from "./supabase-db";
import { createSupabaseStore, type SupabaseStore } from "./supabase-store";

export { parseBackup, type BackupSummary, type ParsedBackup } from "./backup";
export type { Repository, TransactionFilter } from "./repository";

/** Where data lives, from the configuration: Supabase when its variables are set. */
export const dataMode: "supabase" | "local" = isSupabaseConfigured ? "supabase" : "local";

let instance: Repository | null = null;
let cloudStore: SupabaseStore | null = null;

/**
 * The configured repository. Switching storage only touches this function.
 * Browser only. In Supabase mode it needs a signed-in user (see AuthGate).
 */
export function getRepository(): Repository {
  if (!instance) {
    if (dataMode === "supabase") {
      cloudStore = createSupabaseStore(createSupabaseDb(getSupabase()));
      // Database ids are UUIDs: readable ids from hand-made import files are replaced.
      instance = createSnapshotRepository(cloudStore, { prepareReplace: remapIds });
      // Coming back to the tab: another device may have changed something.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") cloudStore?.invalidate();
      });
    } else {
      instance = createLocalRepository({ storage: window.localStorage, initialData: () => createSeedData() });
    }
  }
  return instance;
}

/** Forget the repository and its cached data (after signing out). */
export function resetRepository(): void {
  instance = null;
  cloudStore = null;
}

/**
 * Repository after generating any recurring transactions due today.
 * Pages load data through this, so automatic transactions appear on their day.
 */
export async function loadRepository(): Promise<Repository> {
  const repo = getRepository();
  await repo.syncPropertyAssets();
  await repo.generateDueTransactions(todayIso());
  return repo;
}

const LAST_BACKUP_KEY = "finanze:lastBackup";

/** All data as a backup file's text, and remembers when it was made. */
export async function exportBackup(): Promise<{ fileName: string; text: string }> {
  const now = new Date();
  const text = JSON.stringify(createBackup(await getRepository().exportSnapshot(), now), null, 2);
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, now.toISOString());
  } catch {
    // Not critical: only used to show the date of the last copy.
  }
  return { fileName: backupFileName(now), text };
}

/** Replaces all data with a parsed backup. */
export async function importBackup(data: Snapshot): Promise<void> {
  await getRepository().replaceAll(data);
  await loadRepository();
}

/** ISO timestamp of the last export from this browser, if any. */
export function lastBackupAt(): string | null {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

/** Replaces all data with fresh fictitious test data. */
export async function restoreSeedData(): Promise<void> {
  await getRepository().replaceAll(createSeedData());
  await loadRepository();
}

/** Deletes every record (in the account or in this browser). Cannot be undone. */
export async function deleteAllData(): Promise<void> {
  await getRepository().replaceAll(emptySnapshot());
}

/** Whether the account (or browser) has no data at all yet. */
export async function isEmpty(): Promise<boolean> {
  const d = await getRepository().exportSnapshot();
  return d.categories.length === 0 && d.transactions.length === 0 && d.properties.length === 0 && d.assets.length === 0;
}

/** Data kept in this browser from phase 1 (localStorage), if any. Supabase mode only. */
export async function browserData(): Promise<{ data: Snapshot; summary: BackupSummary } | null> {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === null) return null;
    const data = await createLocalStore({ storage: window.localStorage }).load();
    return { data, summary: summarize(data) };
  } catch {
    return null;
  }
}

/** Replaces the account's data with this browser's (phase 1) data. */
export async function uploadBrowserData(): Promise<void> {
  const local = await browserData();
  if (!local) throw new Error("No hay datos en este navegador.");
  await importBackup(local.data);
}
