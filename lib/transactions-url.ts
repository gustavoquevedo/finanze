/** URL query params for the transactions list, so filters can be linked and survive "back". */
export const PERSONAL = "personal";

export interface TransactionsQuery {
  /** `YYYY-MM` */
  mes?: string;
  /** Property id, or `"personal"`. */
  piso?: string;
  categoria?: string;
}

export function transactionsHref(query: TransactionsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/movimientos?${qs}` : "/movimientos";
}
