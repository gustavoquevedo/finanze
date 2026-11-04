import { todayIso } from "@/lib/domain/dates";
import type { Snapshot } from "@/lib/domain/types";
import { backupFileName, createBackup } from "./backup";
import { createLocalRepository } from "./local";
import type { Repository } from "./repository";
import { createSeedData } from "./seed";

export { parseBackup, type BackupSummary, type ParsedBackup } from "./backup";
export type { Repository, TransactionFilter } from "./repository";

let instance: Repository | null = null;

/**
 * The configured repository. Switching to Supabase (phase 2) only touches this function.
 * Browser only: phase 1 stores data in `localStorage`.
 */
export function getRepository(): Repository {
  if (!instance) {
    instance = createLocalRepository({ storage: window.localStorage, initialData: () => createSeedData() });
  }
  return instance;
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
}
