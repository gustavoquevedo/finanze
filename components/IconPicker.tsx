"use client";

import { useState } from "react";
import { ICONS, searchIcons } from "@/lib/icons/catalog";
import { Icon } from "@/lib/icons/Icon";
import { inputClass } from "./form-styles";
import { Sheet } from "./Sheet";

/** Button showing the current icon; opens a searchable grid of the catalogue. */
export function IconPicker({ id, value, onChange }: { id: string; value: string | null; onChange: (icon: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = ICONS.find((i) => i.id === value);
  const results = searchIcons(query);

  const pick = (icon: string | null) => {
    onChange(icon);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`${inputClass} flex items-center gap-3 text-left`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
          <Icon name={value} className="h-5 w-5 text-slate-700" />
        </span>
        <span className="flex-1">{current ? current.label : "Sin icono"}</span>
        <span className="text-sm font-medium text-emerald-700">Cambiar</span>
      </button>
      {open && (
        <Sheet title="Elige un icono" onClose={() => (setOpen(false), setQuery(""))}>
          <div className="border-b border-slate-100 p-3">
            <input
              type="search"
              aria-label="Buscar icono"
              placeholder="Buscar: luz, seguro, oro…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <button
              type="button"
              onClick={() => pick(null)}
              aria-pressed={value === null}
              className={`mb-3 w-full rounded-lg border px-3 py-2 text-sm ${value === null ? "border-emerald-600 bg-emerald-50 font-semibold" : "border-slate-200"}`}
            >
              Sin icono
            </button>
            {results.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Sin resultados.</p>}
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {results.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => pick(i.id)}
                    aria-pressed={value === i.id}
                    title={i.label}
                    className={`flex w-full flex-col items-center gap-1 rounded-lg border px-1 py-2 ${value === i.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 active:bg-slate-50"}`}
                  >
                    <Icon name={i.id} className="h-6 w-6 text-slate-700" />
                    <span className="w-full truncate text-center text-[11px] text-slate-600">{i.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Sheet>
      )}
    </>
  );
}
