import { parseEuros } from "./money";
import type { Property } from "./types";

export interface PropertyFormValues {
  name: string;
  address: string;
  purchaseDate: string;
  acquisitionPrice: string;
  purchaseCosts: string;
  /** Optional. */
  cadastralValue: string;
  constructionPercentage: string;
  active: boolean;
}

export type PropertyFormErrors = Partial<Record<keyof PropertyFormValues, string>>;
export type PropertyFormResult = { ok: true; value: Omit<Property, "id"> } | { ok: false; errors: PropertyFormErrors };

/** Validates the property form. Amounts in euros, Spanish format. Messages in Spanish (UI). */
export function validatePropertyForm(values: PropertyFormValues): PropertyFormResult {
  const errors: PropertyFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Indica un nombre.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.purchaseDate)) errors.purchaseDate = "Indica la fecha de compra.";

  const price = parseEuros(values.acquisitionPrice);
  if (price === null || price <= 0) errors.acquisitionPrice = "Importe no válido. Ejemplo: 168.000";
  const costs = values.purchaseCosts.trim() ? parseEuros(values.purchaseCosts) : 0;
  if (costs === null) errors.purchaseCosts = "Importe no válido.";
  const cadastral = values.cadastralValue.trim() ? parseEuros(values.cadastralValue) : null;
  if (values.cadastralValue.trim() && cadastral === null) errors.cadastralValue = "Importe no válido.";

  const pct = Number(values.constructionPercentage.replace(",", "."));
  if (!values.constructionPercentage.trim() || !Number.isFinite(pct) || pct <= 0 || pct > 100) {
    errors.constructionPercentage = "Indica un porcentaje entre 0 y 100.";
  }

  if (Object.keys(errors).length > 0 || price === null || costs === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      address: values.address.trim(),
      purchaseDate: values.purchaseDate,
      acquisitionPrice: price,
      purchaseCosts: costs,
      cadastralValue: cadastral,
      constructionPercentage: Math.round(pct * 100) / 100,
      active: values.active,
    },
  };
}
