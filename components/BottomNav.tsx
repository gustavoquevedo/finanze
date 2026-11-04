"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSectionActive, NAV_ITEMS } from "./nav-items";


export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl">
        {NAV_ITEMS.map((item) => {
          const active = isSectionActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "font-semibold text-emerald-700" : "text-slate-500"}`}
              >
                <span aria-hidden className="text-lg leading-none">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
