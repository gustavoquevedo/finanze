import type { Category } from "@/lib/domain/types";
import type { PickerGroup } from "@/lib/option-search";
import { OptionPicker } from "./OptionPicker";

/** What a category is, in a few words: «Gasto · deducible», «No es gasto»… */
export function categoryHint(c: Category): string {
  if (c.notExpense) return "No es gasto";
  return [c.type === "gasto" ? "Gasto" : "Ingreso", c.deductible && "deducible", c.limitedDeduction && "con límite"]
    .filter(Boolean)
    .join(" · ");
}

/** Category picker with icons, grouped into income and expenses. */
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
  const option = (c: Category) => ({ id: c.id, name: c.name, icon: c.icon, hint: categoryHint(c) });
  const groups: PickerGroup[] = [
    { label: "Ingresos", options: categories.filter((c) => c.type === "ingreso").map(option) },
    { label: "Gastos", options: categories.filter((c) => c.type === "gasto").map(option) },
  ].filter((g) => g.options.length > 0);
  return (
    <OptionPicker
      id={id}
      title="Elige una categoría"
      groups={groups}
      value={value}
      onChange={onChange}
      placeholder="Elige una categoría"
      invalid={invalid}
    />
  );
}

export function CategoryHint({ category }: { category?: Category }) {
  if (!category) return null;
  return (
    <p className={`mt-1 text-sm ${category.type === "gasto" && !category.notExpense ? "text-rose-700" : category.notExpense ? "text-slate-600" : "text-emerald-700"}`}>
      {category.notExpense ? "No es gasto (no resta del neto)" : category.type === "gasto" ? "Gasto" : "Ingreso"}
      {category.deductible && " · deducible en la Renta"}
    </p>
  );
}
