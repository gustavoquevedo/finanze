export const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/movimientos", label: "Movimientos", icon: "📋" },
  { href: "/recurrentes", label: "Recurrentes", icon: "🔁" },
  { href: "/pisos", label: "Pisos", icon: "🏢" },
];

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);
