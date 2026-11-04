/** URL query params for the transactions list, so filters can be linked and survive "back". */
export const PERSONAL = "personal";
/** `estado` value for pending (automatic, not yet confirmed) transactions. */
export const PENDING = "pendientes";

export interface TransactionsQuery {
  /** `YYYY-MM` */
  mes?: string;
  /** Property id, or `"personal"`. */
  piso?: string;
  categoria?: string;
  /** `"pendientes"` to show only pending transactions. */
  estado?: string;
}

export function transactionsHref(query: TransactionsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/movimientos?${qs}` : "/movimientos";
}
