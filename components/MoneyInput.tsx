"use client";

import { parseEuros } from "@/lib/domain/money";
import { formatCents } from "@/lib/format";
import { inputClass } from "./form-styles";

/**
 * Amount input that accepts Spanish or English formats and shows how it was read
 * ("102,219.00" → "= 102.219,00 €").
 */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = "0,00",
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const cents = value.trim() ? parseEuros(value) : null;
  return (
    <div>
      <input
        id={id}
        className={inputClass}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || (value.trim() !== "" && cents === null)}
      />
      {value.trim() !== "" && (
        <p className={`mt-1 text-xs ${cents === null ? "text-rose-700" : "text-slate-500"}`}>
          {cents === null ? "No se entiende el importe" : `= ${formatCents(cents)}`}
        </p>
      )}
    </div>
  );
}
