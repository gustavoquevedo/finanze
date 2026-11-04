import type { Cents } from "./types";

/**
 * Parses an amount typed in euros, Spanish style ("950,50", "1.234,5", "12") or with a dot
 * as decimal separator ("950.50"). Returns integer cents, or `null` if invalid.
 */
export function parseEuros(input: string): Cents | null {
  let s = input.trim().replace(/\s|€/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    // Comma is the decimal separator; dots are thousands separators.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" → thousands separator, not decimals.
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, decimals = ""] = s.split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
}

/** Cents → value for an amount input ("950,50"). */
export function centsToInput(cents: Cents): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, "0")}`;
}
