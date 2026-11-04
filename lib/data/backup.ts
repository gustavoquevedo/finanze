import type { Snapshot } from "@/lib/domain/types";
import { checkImport } from "./import-check";

export const BACKUP_FORMAT = "finanze-backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO timestamp. */
  exportedAt: string;
  data: Snapshot;
}

const COLLECTIONS = [
  "properties",
  "categories",
  "transactions",
  "recurrings",
  "assetTypes",
  "assets",
  "assetSnapshots",
  "portfolios",
] as const satisfies readonly (keyof Snapshot)[];

export type BackupSummary = Record<(typeof COLLECTIONS)[number], number>;

export function createBackup(data: Snapshot, now: Date = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

/** `finanze-copia-2026-11-04.json` */
export function backupFileName(now: Date = new Date()): string {
  return `finanze-copia-${now.toISOString().slice(0, 10)}.json`;
}

export function summarize(data: Snapshot): BackupSummary {
  return Object.fromEntries(COLLECTIONS.map((k) => [k, data[k].length])) as BackupSummary;
}

export type ParsedBackup =
  | { ok: true; data: Snapshot; exportedAt: string | null; summary: BackupSummary }
  | { ok: false; error: string };

/**
 * Reads a backup file. Older backups (missing collections or fields) are upgraded the same way
 * stored data is. Messages are in Spanish (UI).
 */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }
  if (!json || typeof json !== "object") return { ok: false, error: "El archivo no tiene el formato de una copia." };
  const obj = json as Partial<Backup>;
  if (obj.format !== BACKUP_FORMAT || !obj.data || typeof obj.data !== "object") {
    return { ok: false, error: "No es una copia de seguridad de esta app." };
  }
  if (typeof obj.version !== "number" || obj.version > BACKUP_VERSION) {
    return { ok: false, error: "La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo." };
  }

  const raw = obj.data as Partial<Record<keyof Snapshot, unknown>>;
  for (const key of COLLECTIONS) {
    const items = raw[key];
    if (items === undefined) continue;
    if (!Array.isArray(items) || items.some((x) => !x || typeof x !== "object" || typeof (x as { id?: unknown }).id !== "string")) {
      return { ok: false, error: `La copia está dañada (${key}).` };
    }
  }
  const { data, errors } = checkImport(raw as Partial<Record<keyof Snapshot, Record<string, unknown>[]>>);
  if (errors.length > 0) {
    const shown = errors.slice(0, 8).join("\n");
    const more = errors.length > 8 ? `\n… y ${errors.length - 8} errores más.` : "";
    return { ok: false, error: `La copia tiene ${errors.length === 1 ? "1 error" : `${errors.length} errores`}:\n${shown}${more}` };
  }

  return { ok: true, data, exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : null, summary: summarize(data) };
}
