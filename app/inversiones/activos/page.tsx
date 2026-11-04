"use client";

import Link from "next/link";
import { Gain } from "@/components/Gain";
import { ASSET_KINDS } from "@/lib/domain/investments";
import { formatCents, formatShortDate } from "@/lib/format";
import { loadInvestments } from "@/lib/investments-data";
import { useData } from "@/lib/use-data";

export default function AssetsPage() {
  const { data, error } = useData(loadInvestments);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Activos</h1>
      <Link
        href="/inversiones/activos/nuevo"
        aria-label="Nuevo activo"
        className="fixed right-4 bottom-20 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl text-white shadow-lg"
      >
        +
      </Link>
      {error && <p className="text-rose-700">Error: {error}</p>}
      {data?.assets.length === 0 && <p className="text-center text-slate-500">No hay activos. Pulsa + para crear uno.</p>}
      {data &&
        ASSET_KINDS.map(({ value: kind, label }) => {
          const items = data.assets.filter((a) => a.kind === kind).map((a) => data.valuations.get(a.id)!);
          if (items.length === 0) return null;
          return (
            <section key={kind} className="space-y-2">
              <h2 className="text-sm font-medium text-slate-500">{kind === "inmobiliario" ? "Inmobiliario (desde Pisos)" : label}</h2>
              <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
                {items.map((v) => (
                  <li key={v.assetId}>
                    <Link
                      href={`/inversiones/activos/editar?id=${encodeURIComponent(v.assetId)}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{v.name}</p>
                        <p className="text-xs text-slate-500">
                          {v.valueDate ? `Valor a ${formatShortDate(v.valueDate)} ${v.valueDate.slice(0, 4)}` : "Sin valor todavía"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        <p className="tabular-nums">{v.value !== null ? formatCents(v.value) : "—"}</p>
                        {kind !== "efectivo" && (
                          <p className="text-xs">
                            <Gain cents={v.gain} base={v.purchaseValue} />
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}
