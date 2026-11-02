import { createLocalRepository } from "./local";
import type { Repository } from "./repository";
import { createSeedData } from "./seed";

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

/** Replaces all data with fresh fictitious test data. */
export async function restoreSeedData(): Promise<void> {
  await getRepository().replaceAll(createSeedData());
}
