"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DATOS, HOME, isActive, isSectionActive, NAV_ITEMS, type NavLink, type NavSection } from "./nav-items";

const linkClass = (active: boolean) =>
  `flex items-center gap-3 rounded-lg px-3 py-3 ${active ? "bg-emerald-50 font-semibold text-emerald-700" : "text-slate-700 hover:bg-slate-50"}`;

function MenuLink({ item, pathname, nested }: { item: NavLink; pathname: string; nested?: boolean }) {
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={`${linkClass(active)} ${nested ? "pl-10" : ""}`}>
      <span aria-hidden>{item.icon}</span>
      {item.label}
    </Link>
  );
}

function MenuGroup({ section, pathname }: { section: NavSection; pathname: string }) {
  const [open, setOpen] = useState(isSectionActive(pathname, section));
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${linkClass(false)} w-full justify-between ${isSectionActive(pathname, section) ? "font-semibold" : ""}`}
      >
        <span className="flex items-center gap-3">
          <span aria-hidden>{section.icon}</span>
          {section.label}
        </span>
        <span aria-hidden className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && (
        <ul>
          {section.children.map((c) => (
            <li key={c.href}>
              <MenuLink item={c} pathname={pathname} nested />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

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
        <nav id="header-menu" className="mx-auto max-h-[75vh] max-w-xl overflow-y-auto border-t border-slate-100 px-2 pb-2">
          <ul>
            {NAV_ITEMS.map((item) =>
              "children" in item ? (
                <MenuGroup key={item.href} section={item} pathname={pathname} />
              ) : (
                <li key={item.href}>
                  <MenuLink item={item ?? HOME} pathname={pathname} />
                </li>
              ),
            )}
            <li className="mt-1 border-t border-slate-100 pt-1">
              <MenuLink item={DATOS} pathname={pathname} />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
