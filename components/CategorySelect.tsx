import type { Category } from "@/lib/domain/types";
import { inputClass } from "./form-styles";

/** Category select grouped into income and expenses. */
export function CategorySelect({
  id,
  categories,
  value,
  onChange,
  invalid,
}: {
  id: string;
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
}) {
  const income = categories.filter((c) => c.type === "ingreso");
  const expense = categories.filter((c) => c.type === "gasto");
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
      <option value="">Elige una categoría</option>
      {income.length > 0 && (
        <optgroup label="Ingresos">
          {income.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      )}
      {expense.length > 0 && (
        <optgroup label="Gastos">
          {expense.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      )}
    </select>
  );
}

export function CategoryHint({ category }: { category?: Category }) {
  if (!category) return null;
  return (
    <p className={`mt-1 text-sm ${category.type === "gasto" ? "text-rose-700" : "text-emerald-700"}`}>
      {category.type === "gasto" ? "Gasto" : "Ingreso"}
      {category.deductible && " · deducible en la Renta"}
    </p>
  );
}
