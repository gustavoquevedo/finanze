import type { CategoryTotal } from "./summary";
import type { Category, Cents, Id, IsoDate, Property, Transaction } from "./types";

/** Annual depreciation rate for the building (not the land). */
export const DEPRECIATION_RATE = 0.03;

export interface Depreciation {
  /** Acquisition price + purchase costs. */
  acquisitionCost: Cents;
  cadastralValue: Cents | null;
  /** Which value was used: the greater of the two. */
  baseSource: "adquisicion" | "catastral";
  constructionPercentage: number;
  /** Building share of the chosen value. */
  base: Cents;
  /** Days owned in the year (prorated in the purchase year). */
  days: number;
  daysInYear: number;
  amount: Cents;
}

export interface RentaSummary {
  year: number;
  propertyId: Id;
  income: Cents;
  incomeCount: number;
  /** Interest and repairs: together limited to the income. */
  limited: CategoryTotal[];
  limitedTotal: Cents;
  limitedAllowed: Cents;
  /** Part over the limit, deductible in the next 4 years. */
  limitedExcess: Cents;
  /** Other deductible expenses (IBI, community, insurance…). */
  other: CategoryTotal[];
  otherTotal: Cents;
  depreciation: Depreciation;
  /** Net income from the property before any reduction. Can be negative. */
  net: Cents;
  /** Pending (unconfirmed) automatic transactions included. */
  pending: number;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dayNumber = (iso: IsoDate) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;

/** Building depreciation for a year: 3% of the building share of max(acquisition cost, cadastral value). */
export function depreciationFor(property: Property, year: number): Depreciation {
  const acquisitionCost = property.acquisitionPrice + property.purchaseCosts;
  const cadastral = property.cadastralValue;
  const useCadastral = cadastral !== null && cadastral > acquisitionCost;
  const base = Math.round(((useCadastral ? cadastral : acquisitionCost) * property.constructionPercentage) / 100);
  const daysInYear = isLeap(year) ? 366 : 365;
  const start = property.purchaseDate > `${year}-01-01` ? property.purchaseDate : `${year}-01-01`;
  const days = Math.max(0, Math.min(daysInYear, dayNumber(`${year}-12-31`) - dayNumber(start) + 1));
  const amount = Math.round((base * DEPRECIATION_RATE * days) / daysInYear);
  return {
    acquisitionCost,
    cadastralValue: cadastral,
    baseSource: useCadastral ? "catastral" : "adquisicion",
    constructionPercentage: property.constructionPercentage,
    base,
    days,
    daysInYear,
    amount,
  };
}

/**
 * Indicative Renta summary for one property and year (rendimientos del capital inmobiliario):
 * income − deductible expenses (interest + repairs capped at income) − building depreciation.
 * Does not apply the reduction for renting a main home, nor furniture depreciation.
 */
export function rentaSummary(transactions: Transaction[], categories: Category[], property: Property, year: number): RentaSummary {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const perCategory = new Map<Id, CategoryTotal>();
  let income = 0;
  let incomeCount = 0;
  let pending = 0;

  for (const t of transactions) {
    if (t.propertyId !== property.id || !t.date.startsWith(`${year}-`)) continue;
    const category = byId.get(t.categoryId);
    if (!category) continue;
    if (t.type === "ingreso") {
      income += t.amount;
      incomeCount += 1;
    } else if (category.deductible && !category.notExpense) {
      const entry = perCategory.get(category.id) ?? { category, amount: 0, count: 0 };
      entry.amount += t.amount;
      entry.count += 1;
      perCategory.set(category.id, entry);
    } else continue;
    if (!t.confirmed) pending += 1;
  }

  const sorted = [...perCategory.values()].sort((a, b) => b.amount - a.amount);
  const limited = sorted.filter((c) => c.category.limitedDeduction);
  const other = sorted.filter((c) => !c.category.limitedDeduction);
  const sum = (xs: CategoryTotal[]) => xs.reduce((s, x) => s + x.amount, 0);
  const limitedTotal = sum(limited);
  const limitedAllowed = Math.min(limitedTotal, income);
  const otherTotal = sum(other);
  const depreciation = depreciationFor(property, year);

  return {
    year,
    propertyId: property.id,
    income,
    incomeCount,
    limited,
    limitedTotal,
    limitedAllowed,
    limitedExcess: limitedTotal - limitedAllowed,
    other,
    otherTotal,
    depreciation,
    net: income - limitedAllowed - otherTotal - depreciation.amount,
    pending,
  };
}
