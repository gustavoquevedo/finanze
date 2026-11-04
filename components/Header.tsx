"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isActive, MENU_ITEMS } from "./nav-items";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
        <Link href="/" className="font-semibold">Finanzas y pisos</Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="header-menu"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="rounded-lg px-3 py-2 text-xl leading-none hover:bg-slate-100"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <nav id="header-menu" className="mx-auto max-w-xl border-t border-slate-100 px-2 pb-2">
          <ul>
            {MENU_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 ${active ? "bg-emerald-50 font-semibold text-emerald-700" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
