export const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/movimientos", label: "Movimientos", icon: "📋" },
  { href: "/recurrentes", label: "Recurrentes", icon: "🔁" },
  { href: "/pisos", label: "Pisos", icon: "🏢" },
];

/** Header menu: main sections plus settings that don't fit in the bottom bar. */
export const MENU_ITEMS = [
  ...NAV_ITEMS,
  { href: "/resumen", label: "Resumen anual", icon: "📊" },
  { href: "/categorias", label: "Categorías", icon: "🏷️" },
];

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);
