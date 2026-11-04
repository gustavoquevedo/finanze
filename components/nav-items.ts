export interface NavLink {
  href: string;
  label: string;
  icon: string;
  description?: string;
}

export interface NavSection extends NavLink {
  /** Pages grouped under this section (URLs are kept as they were). */
  children: NavLink[];
}

export const FINANZAS: NavSection = {
  href: "/finanzas",
  label: "Finanzas",
  icon: "💶",
  children: [
    { href: "/movimientos", label: "Movimientos", icon: "📋", description: "Ingresos y gastos, filtros y pendientes" },
    { href: "/recurrentes", label: "Recurrentes", icon: "🔁", description: "Alquileres, recibos e hipotecas" },
    { href: "/pisos", label: "Pisos", icon: "🏢", description: "Fichas y totales del año" },
    { href: "/resumen", label: "Resumen anual", icon: "📊", description: "Por categoría y por mes" },
    { href: "/renta", label: "Renta", icon: "🧾", description: "Rendimiento de cada piso para la declaración" },
    { href: "/categorias", label: "Categorías", icon: "🏷️", description: "Deducibles, no es gasto y límites" },
  ],
};

export const INVERSIONES: NavSection = {
  href: "/inversiones",
  label: "Inversiones",
  icon: "📈",
  children: [
    { href: "/inversiones/carteras", label: "Carteras", icon: "🗂️", description: "Totales, plusvalías y pesos" },
    { href: "/inversiones/activos", label: "Activos", icon: "💼", description: "Fondos, ETF, efectivo e inmobiliario" },
  ],
};

export const HOME: NavLink = { href: "/", label: "Inicio", icon: "🏠" };

export const DATOS: NavLink = { href: "/datos", label: "Datos y copia", icon: "💾" };

/** Bottom bar and top level of the header menu. */
export const NAV_ITEMS: (NavLink | NavSection)[] = [HOME, FINANZAS, INVERSIONES];

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

/** A section is active on its own page or any of its children's. */
export const isSectionActive = (pathname: string, item: NavLink | NavSection) =>
  isActive(pathname, item.href) || ("children" in item && item.children.some((c) => isActive(pathname, c.href)));
