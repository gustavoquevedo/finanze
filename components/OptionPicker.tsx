"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { filterGroups, flatten, fold, type PickerGroup, type PickerOption } from "@/lib/option-search";
import { inputClass } from "./form-styles";
import { Sheet } from "./Sheet";

interface Props {
  /** Id of the trigger button (a <label htmlFor> can point to it). */
  id: string;
  /** Title of the sheet. */
  title: string;
  groups: PickerGroup[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Adds a first option with id "" (e.g. «Sin tipo»). */
  noneLabel?: string;
  invalid?: boolean;
}

/** Search shown from this many options on. */
const SEARCH_FROM = 8;

/**
 * Select replacement that shows each option's icon. Opens a sheet with a searchable listbox:
 * arrows move, Enter picks, Esc closes.
 */
export function OptionPicker({ id, title, groups, value, onChange, placeholder = "Elige una opción", noneLabel, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const all = useMemo(
    () => (noneLabel !== undefined ? [{ options: [{ id: "", name: noneLabel, icon: null }] }, ...groups] : groups),
    [groups, noneLabel],
  );
  const selected = flatten(all).find((o) => o.id === value && (o.id !== "" || noneLabel !== undefined));

  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`${inputClass} flex items-center gap-3 text-left ${invalid ? "border-rose-400" : ""}`}
      >
        {selected ? (
          <>
            <Icon name={selected.icon} className="h-5 w-5 text-slate-600" />
            <span className="min-w-0 flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-slate-500">{placeholder}</span>
        )}
        <span aria-hidden className="text-slate-400">▾</span>
      </button>
      {open && (
        <PickerSheet
          title={title}
          groups={all}
          value={value}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PickerSheet({ title, groups, value, onPick, onClose }: { title: string; groups: PickerGroup[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const visible = filterGroups(groups, query);
  const options = flatten(visible);
  const total = flatten(groups).length;
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.id === value)));
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const current = Math.min(active, Math.max(0, options.length - 1));
  const hasSearch = total >= SEARCH_FROM;
  // Type-ahead when there is no search box: typed letters jump to the first matching option.
  const typed = useRef({ text: "", at: 0 });

  function moveTo(i: number) {
    setActive(i);
    document.getElementById(optionId(i))?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!hasSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 800 ? typed.current.text : "") + fold(e.key), at: now };
      const i = options.findIndex((o) => fold(o.name).startsWith(typed.current.text));
      if (i >= 0) moveTo(i);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      moveTo((current + step + options.length) % Math.max(1, options.length));
    } else if (e.key === "Enter" && options[current]) {
      e.preventDefault();
      onPick(options[current].id);
    }
  }

  let index = -1;
  return (
    <Sheet title={title} onClose={onClose}>
      <div onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
        {hasSearch ? (
          <div className="border-b border-slate-100 p-3">
            <input
              type="search"
              aria-label="Buscar"
              aria-controls={listId}
              aria-activedescendant={options[current] ? optionId(current) : undefined}
              placeholder="Buscar…"
              value={query}
              onChange={(e) => (setQuery(e.target.value), setActive(0))}
              className={inputClass}
            />
          </div>
        ) : null}
        <div
          id={listId}
          role="listbox"
          aria-label={title}
          tabIndex={hasSearch ? -1 : 0}
          data-autofocus
          aria-activedescendant={options[current] ? optionId(current) : undefined}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 outline-none"
        >
          {options.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Sin resultados.</p>}
          {visible.map((g, gi) => (
            <div key={g.label ?? `g${gi}`} role="group" aria-label={g.label}>
              {g.label && <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{g.label}</p>}
              {g.options.map((o: PickerOption) => {
                index += 1;
                const i = index;
                const isSelected = o.id === value;
                return (
                  <div
                    key={o.id || "__none"}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onPick(o.id)}
                    onMouseMove={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 ${i === current ? "bg-slate-100" : ""} ${isSelected ? "font-semibold text-emerald-800" : ""}`}
                  >
                    <Icon name={o.icon} className="h-5 w-5 text-slate-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.name}</span>
                      {o.hint && <span className="block truncate text-xs font-normal text-slate-500">{o.hint}</span>}
                    </span>
                    {isSelected && <span aria-hidden className="text-emerald-700">✓</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
