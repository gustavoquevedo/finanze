import { addMonths, dayInMonth, todayIso } from "@/lib/domain/dates";
import { mortgageSchedule } from "@/lib/domain/mortgage";
import type { Category, Property, Recurring, Snapshot, Transaction } from "@/lib/domain/types";
import { newId } from "./ids";

/**
 * Fictitious test data: 2 flats, the 6 full months before `today`'s month.
 * Names, addresses and amounts are made up.
 */
export const SEED_MONTHS = 6;

const euros = (value: number) => Math.round(value * 100);

type CategoryKey =
  | "alquiler" | "intereses" | "capital" | "ibi" | "comunidad" | "seguroHogar" | "seguroImpago"
  | "reparaciones" | "suministros" | "basuras" | "gestoria" | "otrosPiso"
  | "nomina" | "alimentacion" | "hogar" | "transporte" | "ocio" | "salud" | "otrosPersonal";

const CATEGORIES: Record<CategoryKey, Omit<Category, "id">> = {
  alquiler: { name: "Alquiler", type: "ingreso", scope: "piso", deductible: false },
  intereses: { name: "Intereses hipoteca", type: "gasto", scope: "piso", deductible: true },
  // Paying off principal is money out, but not a deductible expense.
  capital: { name: "Amortización capital hipoteca", type: "gasto", scope: "piso", deductible: false },
  ibi: { name: "IBI", type: "gasto", scope: "piso", deductible: true },
  comunidad: { name: "Comunidad", type: "gasto", scope: "piso", deductible: true },
  seguroHogar: { name: "Seguro hogar", type: "gasto", scope: "piso", deductible: true },
  seguroImpago: { name: "Seguro impago", type: "gasto", scope: "piso", deductible: true },
  reparaciones: { name: "Reparaciones y conservación", type: "gasto", scope: "piso", deductible: true },
  suministros: { name: "Suministros", type: "gasto", scope: "piso", deductible: true },
  basuras: { name: "Tasa de basuras", type: "gasto", scope: "piso", deductible: true },
  gestoria: { name: "Gestoría", type: "gasto", scope: "piso", deductible: true },
  otrosPiso: { name: "Otros", type: "gasto", scope: "piso", deductible: false },
  nomina: { name: "Nómina", type: "ingreso", scope: "personal", deductible: false },
  alimentacion: { name: "Alimentación", type: "gasto", scope: "personal", deductible: false },
  hogar: { name: "Hogar y suministros", type: "gasto", scope: "personal", deductible: false },
  transporte: { name: "Transporte", type: "gasto", scope: "personal", deductible: false },
  ocio: { name: "Ocio", type: "gasto", scope: "personal", deductible: false },
  salud: { name: "Salud", type: "gasto", scope: "personal", deductible: false },
  otrosPersonal: { name: "Otros personales", type: "gasto", scope: "personal", deductible: false },
};

export function createSeedData(today: string = todayIso()): Snapshot {
  const currentMonth = today.slice(0, 7);
  const months = Array.from({ length: SEED_MONTHS }, (_, i) => addMonths(currentMonth, i - SEED_MONTHS));
  const firstDay = dayInMonth(months[0], 1);

  const cat = Object.fromEntries(
    Object.entries(CATEGORIES).map(([key, value]) => [key, { ...value, id: newId() }]),
  ) as Record<CategoryKey, Category>;

  const centro: Property = {
    id: newId(),
    name: "Piso Centro",
    address: "Calle del Ejemplo 12, 3º B, Valladolid",
    purchaseDate: "2019-03-15",
    acquisitionPrice: euros(168000),
    constructionPercentage: 62,
    active: true,
  };
  const playa: Property = {
    id: newId(),
    name: "Apartamento Playa",
    address: "Avenida Ficticia 4, 1º A, Gandía",
    purchaseDate: "2022-06-01",
    acquisitionPrice: euros(129500),
    constructionPercentage: 55,
    active: true,
  };

  const transactions: Transaction[] = [];
  const recurrings: Recurring[] = [];

  const add = (t: Omit<Transaction, "id" | "recurringId" | "type">, recurringId: string | null = null) => {
    transactions.push({ ...t, id: newId(), type: categoryById(t.categoryId).type, recurringId });
  };
  const categoryById = (id: string) => Object.values(cat).find((c) => c.id === id)!;

  const recurring = (r: Omit<Recurring, "id" | "type" | "startDate" | "endDate">) => {
    const rule: Recurring = {
      ...r,
      id: newId(),
      type: categoryById(r.categoryId).type,
      startDate: firstDay,
      endDate: null,
    };
    recurrings.push(rule);
    return rule;
  };

  // Monthly recurring rules, with their generated transactions.
  const monthly = [
    recurring({ concept: "Alquiler Piso Centro", amount: euros(950), categoryId: cat.alquiler.id, propertyId: centro.id, frequency: "mensual", day: 1 }),
    recurring({ concept: "Alquiler Apartamento Playa", amount: euros(780), categoryId: cat.alquiler.id, propertyId: playa.id, frequency: "mensual", day: 5 }),
    recurring({ concept: "Comunidad Piso Centro", amount: euros(65), categoryId: cat.comunidad.id, propertyId: centro.id, frequency: "mensual", day: 10 }),
    recurring({ concept: "Comunidad Apartamento Playa", amount: euros(48), categoryId: cat.comunidad.id, propertyId: playa.id, frequency: "mensual", day: 10 }),
    recurring({ concept: "Nómina", amount: euros(2350), categoryId: cat.nomina.id, propertyId: null, frequency: "mensual", day: 28 }),
  ];
  for (const month of months) {
    for (const r of monthly) {
      add({ date: dayInMonth(month, r.day), amount: r.amount, categoryId: r.categoryId, propertyId: r.propertyId, concept: r.concept }, r.id);
    }
  }

  // Mortgages: each installment split into interest (deductible) and principal (not an expense).
  const mortgages = [
    { property: centro, principal: euros(120000), rate: 2.9, years: 25, paidBefore: monthsBetween(centro.purchaseDate, firstDay), day: 2 },
    { property: playa, principal: euros(95000), rate: 3.4, years: 30, paidBefore: monthsBetween(playa.purchaseDate, firstDay), day: 3 },
  ];
  for (const m of mortgages) {
    const schedule = mortgageSchedule(m.principal, m.rate, m.years * 12);
    months.forEach((month, i) => {
      const q = schedule[m.paidBefore + i];
      const date = dayInMonth(month, m.day);
      add({ date, amount: q.interest, categoryId: cat.intereses.id, propertyId: m.property.id, concept: `Hipoteca ${m.property.name} · intereses cuota ${q.number}` });
      add({ date, amount: q.principal, categoryId: cat.capital.id, propertyId: m.property.id, concept: `Hipoteca ${m.property.name} · capital cuota ${q.number}` });
    });
  }

  // One-off and yearly flat expenses spread over the period.
  const flat = (monthIndex: number, day: number, amount: number, key: CategoryKey, property: Property, concept: string) =>
    add({ date: dayInMonth(months[monthIndex], day), amount: euros(amount), categoryId: cat[key].id, propertyId: property.id, concept });

  flat(0, 20, 412.37, "ibi", centro, "IBI Piso Centro (1er plazo)");
  flat(3, 20, 412.36, "ibi", centro, "IBI Piso Centro (2º plazo)");
  flat(2, 15, 538.9, "ibi", playa, "IBI Apartamento Playa");
  flat(1, 7, 286.4, "seguroHogar", centro, "Seguro hogar anual");
  flat(4, 7, 214.75, "seguroHogar", playa, "Seguro hogar anual");
  flat(1, 8, 315, "seguroImpago", centro, "Seguro de impago anual");
  flat(2, 18, 96.8, "basuras", playa, "Tasa de basuras");
  flat(2, 22, 180, "reparaciones", centro, "Fontanero: cambio de grifo y latiguillos");
  flat(4, 12, 345.5, "reparaciones", playa, "Pintura salón");
  flat(5, 25, 121, "gestoria", centro, "Gestoría: renovación contrato");
  flat(3, 6, 38.9, "suministros", playa, "Luz entre inquilinos");

  // Personal expenses.
  const personal: [number, number, number, CategoryKey, string][] = [];
  months.forEach((_, i) => {
    personal.push(
      [i, 3, 92.4 + i * 3.1, "alimentacion", "Supermercado"],
      [i, 17, 118.75 - i * 2.4, "alimentacion", "Supermercado"],
      [i, 9, 64.2 + (i % 3) * 7.5, "hogar", "Luz y gas"],
      [i, 11, 35, "hogar", "Fibra y móvil"],
      [i, 14, 45 + (i % 2) * 20, "transporte", "Gasolina"],
    );
  });
  personal.push(
    [0, 21, 58, "ocio", "Cena con amigos"],
    [2, 26, 124.9, "ocio", "Entradas concierto"],
    [3, 4, 42, "salud", "Farmacia"],
    [4, 19, 75, "salud", "Dentista: revisión"],
    [5, 15, 39.99, "otrosPersonal", "Regalo cumpleaños"],
  );
  for (const [i, day, amount, key, concept] of personal) {
    add({ date: dayInMonth(months[i], day), amount: euros(amount), categoryId: cat[key].id, propertyId: null, concept });
  }

  return { properties: [centro, playa], categories: Object.values(cat), transactions, recurrings };
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
