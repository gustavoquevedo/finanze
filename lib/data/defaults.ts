import type { AssetType, Category } from "@/lib/domain/types";

/** Starting categories (AGENTS.md list for flats, plus common personal ones), with their icon. */
export const DEFAULT_CATEGORIES = {
  alquiler: { name: "Alquiler", type: "ingreso", scope: "piso", deductible: false, icon: "key" },
  intereses: { name: "Intereses hipoteca", type: "gasto", scope: "piso", deductible: true, limitedDeduction: true, icon: "percent" },
  // Paying off principal is money out, but not a deductible expense.
  capital: { name: "Amortización capital hipoteca", type: "gasto", scope: "piso", deductible: false, notExpense: true, icon: "piggy-bank" },
  ibi: { name: "IBI", type: "gasto", scope: "piso", deductible: true, icon: "landmark" },
  comunidad: { name: "Comunidad", type: "gasto", scope: "piso", deductible: true, icon: "building" },
  seguroHogar: { name: "Seguro hogar", type: "gasto", scope: "piso", deductible: true, icon: "shield" },
  seguroImpago: { name: "Seguro impago", type: "gasto", scope: "piso", deductible: true, icon: "shield-check" },
  reparaciones: { name: "Reparaciones y conservación", type: "gasto", scope: "piso", deductible: true, limitedDeduction: true, icon: "wrench" },
  suministros: { name: "Suministros", type: "gasto", scope: "piso", deductible: true, icon: "zap" },
  basuras: { name: "Tasa de basuras", type: "gasto", scope: "piso", deductible: true, icon: "trash" },
  gestoria: { name: "Gestoría", type: "gasto", scope: "piso", deductible: true, icon: "file-text" },
  otrosPiso: { name: "Otros", type: "gasto", scope: "piso", deductible: false, icon: "tag" },
  nomina: { name: "Nómina", type: "ingreso", scope: "personal", deductible: false, icon: "briefcase" },
  alimentacion: { name: "Alimentación", type: "gasto", scope: "personal", deductible: false, icon: "shopping-cart" },
  hogar: { name: "Hogar y suministros", type: "gasto", scope: "personal", deductible: false, icon: "house" },
  transporte: { name: "Transporte", type: "gasto", scope: "personal", deductible: false, icon: "car" },
  ocio: { name: "Ocio", type: "gasto", scope: "personal", deductible: false, icon: "ticket" },
  salud: { name: "Salud", type: "gasto", scope: "personal", deductible: false, icon: "heart-pulse" },
  otrosPersonal: { name: "Otros personales", type: "gasto", scope: "personal", deductible: false, icon: "package" },
} satisfies Record<string, Omit<Category, "id" | "notExpense" | "limitedDeduction"> & Partial<Pick<Category, "notExpense" | "limitedDeduction">>>;

export type DefaultCategoryKey = keyof typeof DEFAULT_CATEGORIES;

/** Default categories as full records (without id). */
export function defaultCategories(): Omit<Category, "id">[] {
  return Object.values(DEFAULT_CATEGORIES).map((c) => ({ notExpense: false, limitedDeduction: false, ...c }) as Omit<Category, "id">);
}

/** Starting asset types, with their icon. */
export const DEFAULT_ASSET_TYPES: Omit<AssetType, "id">[] = [
  { name: "Renta variable", icon: "trending-up" },
  { name: "Renta fija", icon: "landmark" },
  { name: "Liquidez", icon: "wallet" },
  { name: "Inmobiliario", icon: "house" },
];
