"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { todayIso } from "@/lib/domain/dates";
import { Icon } from "@/lib/icons/Icon";
import { rentaSummary } from "@/lib/domain/renta";
import type { CategoryTotal } from "@/lib/domain/summary";
import { availableYears } from "@/lib/domain/summary";
import { formatCents } from "@/lib/format";
import { transactionsHref } from "@/lib/transactions-url";
import { useData } from "@/lib/use-data";

export default function RentaPage() {
  return (
    <Suspense>
      <Renta />
    </Suspense>
  );
}

const Row = ({ label, value, strong, href, muted }: { label: React.ReactNode; value: string; strong?: boolean; href?: string; muted?: boolean }) => {
  const inner = (
    <>
      <span className={`min-w-0 ${muted ? "text-slate-500" : ""}`}>{label}</span>
      <span className={`shrink-0 tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</span>
    </>
  );
  const cls = "flex items-center justify-between gap-3 px-4 py-2.5 text-sm";
  return href ? (
    <Link href={href} className={`${cls} active:bg-slate-50`}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
};

function Renta() {
  const router = useRouter();
  const params = useSearchParams();
  const currentYear = Number(todayIso().slice(0, 4));
  const year = Number(params.get("anio")) || currentYear;

  const { data, error } = useData(async (repo) => {
    const [transactions, categories, properties] = await Promise.all([
      repo.listTransactions(),
      repo.listCategories(),
      repo.listProperties(),
    ]);
    return { transactions, categories, properties, years: availableYears(transactions, currentYear) };
  });

  const property = data?.properties.find((p) => p.id === params.get("piso")) ?? data?.properties[0];
  const s = data && property ? rentaSummary(data.transactions, data.categories, property, year) : null;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    router.replace(`/renta?${next}`, { scroll: false });
  };
  const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm";
  const link = (categoryId: string) => transactionsHref({ anio: String(year), piso: property?.id, categoria: categoryId });
  const rows = (items: CategoryTotal[]) =>
    items.map((c) => (
      <Row
        key={c.category.id}
        label={
          <span className="flex items-center gap-2">
            <Icon name={c.category.icon} className="h-4 w-4 text-slate-500" />
            {c.category.name}
          </span>
        }
        value={formatCents(c.amount)}
        href={link(c.category.id)}
      />
    ));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Resumen para la Renta</h1>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        ⚠️ Cálculo orientativo de los rendimientos del capital inmobiliario. No sustituye a un asesor ni a los datos fiscales de la AEAT.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Año" className={selectClass} value={year} onChange={(e) => setParam("anio", e.target.value)}>
          {(data?.years ?? [year]).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select aria-label="Piso" className={selectClass} value={property?.id ?? ""} onChange={(e) => setParam("piso", e.target.value)}>
          {data?.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && <p className="text-rose-700">Error: {error}</p>}
      {data && !property && <p className="text-center text-slate-500">No hay pisos.</p>}
      {s && property && (
        <>
          <section className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
            <Row label={<span className="font-medium">Ingresos íntegros</span>} value={formatCents(s.income)} strong />
            <Row label={`${s.incomeCount} cobros de alquiler`} value="" muted />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-500">Intereses y reparaciones (con límite)</h2>
            <div className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
              {s.limited.length === 0 ? <Row label="Sin gastos" value={formatCents(0)} muted /> : rows(s.limited)}
              {s.limitedExcess > 0 && (
                <>
                  <Row label="Límite: no pueden superar los ingresos" value={`−${formatCents(s.limitedExcess)}`} muted />
                  <p className="px-4 py-2 text-xs text-amber-800">
                    Exceso de {formatCents(s.limitedExcess)}: se puede deducir en los 4 años siguientes, con el mismo límite.
                  </p>
                </>
              )}
              <Row label={<span className="font-medium">Deducible</span>} value={formatCents(s.limitedAllowed)} strong />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-500">Otros gastos deducibles</h2>
            <div className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
              {s.other.length === 0 ? <Row label="Sin gastos" value={formatCents(0)} muted /> : rows(s.other)}
              <Row label={<span className="font-medium">Total</span>} value={formatCents(s.otherTotal)} strong />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-500">Amortización del inmueble (3%)</h2>
            <div className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
              <Row label="Coste de adquisición (precio + gastos)" value={formatCents(s.depreciation.acquisitionCost)} muted />
              <Row
                label="Valor catastral"
                value={s.depreciation.cadastralValue !== null ? formatCents(s.depreciation.cadastralValue) : "Sin indicar"}
                muted
              />
              <Row
                label={`Base: ${s.depreciation.constructionPercentage}% construcción del ${s.depreciation.baseSource === "catastral" ? "valor catastral" : "coste de adquisición"}`}
                value={formatCents(s.depreciation.base)}
                muted
              />
              {s.depreciation.days < s.depreciation.daysInYear && (
                <Row label={`Prorrateo: ${s.depreciation.days} de ${s.depreciation.daysInYear} días`} value="" muted />
              )}
              <Row label={<span className="font-medium">Amortización</span>} value={formatCents(s.depreciation.amount)} strong />
              {s.depreciation.cadastralValue === null && (
                <p className="px-4 py-2 text-xs text-amber-800">
                  Falta el valor catastral: se usa el coste de adquisición.{" "}
                  <Link href={`/pisos/editar?id=${encodeURIComponent(property.id)}`} className="font-medium underline">Añadirlo</Link>
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Rendimiento neto</span>
              <span className={`text-lg font-bold tabular-nums ${s.net < 0 ? "text-rose-700" : ""}`}>{formatCents(s.net)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Ingresos − intereses y reparaciones − otros gastos − amortización.
            </p>
          </section>

          <section className="space-y-1 text-xs text-slate-500">
            <p className="font-medium">No incluido:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Reducción por alquiler de vivienda habitual del inquilino (50 % a 90 % según contrato y zona; 60 % en contratos anteriores al 26/05/2023). Solo se aplica sobre un rendimiento neto positivo.</li>
              <li>Amortización de muebles y electrodomésticos (10 % anual).</li>
              <li>Prorrateo por los días que el piso no estuvo alquilado ni en alquiler; esos días tributan como imputación de rentas.</li>
              <li>Excesos de intereses y reparaciones de años anteriores.</li>
            </ul>
            {s.pending > 0 && (
              <p className="text-amber-800">
                Incluye {s.pending === 1 ? "1 movimiento automático" : `${s.pending} movimientos automáticos`} sin confirmar.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
