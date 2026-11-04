import type { Cents } from "./types";

/**
 * Parses an amount typed in euros in Spanish or English style and returns integer cents, or
 * `null` if invalid. "102.219,00", "102,219.00", "102219", "102219.00" and "102219,00" are all
 * 10221900.
 * - With both separators, the last one is the decimal separator.
 * - With one kind only: repeated, or followed by exactly 3 digits, it groups thousands
 *   ("102.219", "1,234,567"); followed by 1-2 digits it is decimal ("950,5", "950.50").
 */
export function parseEuros(input: string): Cents | null {
  const s = input.replace(/[\s€\u00a0]/g, "");
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let whole = s;
  let decimals = "";

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalAt = Math.max(lastDot, lastComma);
    const thousands = decimalAt === lastDot ? "," : ".";
    whole = s.slice(0, decimalAt);
    decimals = s.slice(decimalAt + 1);
    if (whole.includes(s[decimalAt]) || !groupsOk(whole, thousands)) return null;
    whole = whole.split(thousands).join("");
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? "." : ",";
    const parts = s.split(sep);
    if (parts.length > 2 || parts[1].length === 3) {
      if (!groupsOk(s, sep)) return null;
      whole = parts.join("");
    } else {
      [whole, decimals] = parts;
    }
  }
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(decimals)) return null;
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
}

/** "1.234.567" style: first group 1-3 digits (not starting with 0), the rest exactly 3. */
function groupsOk(s: string, sep: string): boolean {
  const groups = s.split(sep);
  return /^[1-9]\d{0,2}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
}

/** Cents → value for an amount input ("950,50"). */
export function centsToInput(cents: Cents): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, "0")}`;
}
