import Link from "next/link";
import type { NavSection } from "./nav-items";

/** Landing page of a section: one card per sub-page. */
export function SectionLinks({ section }: { section: NavSection }) {
  return (
    <ul className="space-y-2">
      {section.children.map((c) => (
        <li key={c.href}>
          <Link href={c.href} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm active:bg-slate-50">
            <span aria-hidden className="text-2xl">{c.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.label}</span>
              {c.description && <span className="block text-sm text-slate-500">{c.description}</span>}
            </span>
            <span aria-hidden className="text-slate-400">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
