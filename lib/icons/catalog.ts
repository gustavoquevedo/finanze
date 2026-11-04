/**
 * Icons available for categories and asset types: a curated set, with Spanish names and keywords
 * for the picker's search. Stored by `id`. No React here, so validation and tests can use it.
 */
export interface IconInfo {
  id: string;
  label: string;
  keywords: string[];
}

const icon = (id: string, label: string, ...keywords: string[]): IconInfo => ({ id, label, keywords });

export const ICONS: IconInfo[] = [
  // Vivienda y pisos
  icon("house", "Casa", "vivienda", "piso", "hogar", "alquiler"),
  icon("building", "Edificio", "piso", "apartamento", "comunidad", "vecinos"),
  icon("hotel", "Apartamento", "turístico", "vacacional", "playa"),
  icon("key", "Llave", "alquiler", "inquilino", "cerrajero", "llaves"),
  icon("landmark", "Institución", "ibi", "impuesto", "ayuntamiento", "hacienda", "banco", "bonos", "renta fija"),
  icon("file-text", "Documento", "contrato", "papeles", "gestoría", "factura"),
  icon("file-signature", "Firma", "contrato", "notaría", "escritura"),
  icon("scale", "Legal", "abogado", "notaría", "juzgado"),
  icon("shield", "Seguro", "seguro hogar", "protección"),
  icon("shield-check", "Seguro impago", "seguro", "garantía", "impago"),
  icon("wrench", "Reparación", "reparaciones", "conservación", "mantenimiento", "fontanero"),
  icon("hammer", "Obra", "reforma", "albañil", "bricolaje"),
  icon("paint-roller", "Pintura", "pintar", "reforma"),
  icon("construction", "Reforma", "obras", "construcción"),
  icon("sofa", "Muebles", "mobiliario", "electrodomésticos", "decoración"),
  icon("plug", "Suministros", "enchufe", "luz", "electricidad"),
  icon("zap", "Electricidad", "luz", "suministros", "energía"),
  icon("flame", "Gas", "calefacción", "butano", "suministros"),
  icon("droplet", "Agua", "suministros", "canal"),
  icon("thermometer", "Calefacción", "climatización", "aire acondicionado"),
  icon("shower-head", "Fontanería", "baño", "termo", "agua caliente"),
  icon("wifi", "Internet", "fibra", "router", "conexión"),
  icon("smartphone", "Móvil", "teléfono", "tarifa"),
  icon("trash", "Basuras", "tasa", "residuos"),
  icon("recycle", "Reciclaje", "residuos", "medio ambiente"),
  icon("lightbulb", "Bombilla", "luz", "ideas"),
  icon("brush", "Limpieza", "limpiar", "servicio doméstico"),

  // Dinero
  icon("wallet", "Cartera", "liquidez", "efectivo", "dinero"),
  icon("banknote", "Billetes", "efectivo", "dinero", "cobro"),
  icon("coins", "Monedas", "dinero", "cambio", "dividendos"),
  icon("piggy-bank", "Ahorro", "hucha", "ahorros", "depósito"),
  icon("hand-coins", "Cobro", "ingreso", "rentas", "pago"),
  icon("euro", "Euro", "dinero", "moneda"),
  icon("credit-card", "Tarjeta", "pago", "banco", "crédito"),
  icon("receipt", "Recibo", "factura", "gasto", "ticket"),
  icon("percent", "Porcentaje", "intereses", "hipoteca", "comisión"),
  icon("calculator", "Calculadora", "contabilidad", "gestoría", "impuestos"),
  icon("briefcase", "Trabajo", "nómina", "salario", "sueldo", "empresa"),
  icon("handshake", "Acuerdo", "comisión", "negocio", "socio"),
  icon("vault", "Caja fuerte", "depósito", "ahorro", "seguridad"),

  // Inversiones
  icon("trending-up", "Subida", "renta variable", "acciones", "bolsa", "crecimiento"),
  icon("trending-down", "Bajada", "pérdidas", "caída"),
  icon("chart-line", "Evolución", "fondos", "inversión", "índice"),
  icon("chart-pie", "Reparto", "cartera", "diversificación", "mixto"),
  icon("gem", "Joya", "oro", "metales", "materias primas"),
  icon("bitcoin", "Bitcoin", "cripto", "criptomonedas"),
  icon("globe", "Mundo", "global", "internacional", "emergentes"),
  icon("factory", "Industria", "empresa", "acciones"),
  icon("leaf", "Sostenible", "esg", "verde", "ecológico"),

  // Personal
  icon("shopping-cart", "Supermercado", "compra", "alimentación", "comida"),
  icon("shopping-basket", "Mercado", "compra", "fruta", "alimentación"),
  icon("store", "Tienda", "comercio", "compras"),
  icon("utensils", "Restaurante", "comida", "cena", "comer fuera"),
  icon("coffee", "Café", "cafetería", "desayuno"),
  icon("wine", "Bebidas", "vino", "bar", "copas"),
  icon("car", "Coche", "transporte", "vehículo", "taller"),
  icon("fuel", "Gasolina", "combustible", "transporte"),
  icon("bus", "Transporte público", "autobús", "metro", "abono"),
  icon("train-front", "Tren", "viaje", "transporte"),
  icon("bike", "Bicicleta", "deporte", "transporte"),
  icon("plane", "Viaje", "vacaciones", "avión", "vuelo"),
  icon("tree-palm", "Vacaciones", "playa", "verano", "escapada"),
  icon("heart-pulse", "Salud", "médico", "seguro médico"),
  icon("pill", "Farmacia", "medicinas", "salud"),
  icon("stethoscope", "Médico", "dentista", "consulta", "salud"),
  icon("dumbbell", "Gimnasio", "deporte", "fitness"),
  icon("shirt", "Ropa", "vestir", "moda"),
  icon("scissors", "Peluquería", "belleza", "estética"),
  icon("gift", "Regalo", "regalos", "cumpleaños", "navidad"),
  icon("party-popper", "Fiesta", "celebración", "ocio"),
  icon("ticket", "Entradas", "concierto", "espectáculo", "ocio"),
  icon("clapperboard", "Cine", "películas", "streaming", "ocio"),
  icon("tv", "Televisión", "streaming", "suscripción", "plataforma"),
  icon("music", "Música", "suscripción", "concierto"),
  icon("gamepad", "Videojuegos", "juegos", "ocio"),
  icon("book", "Libros", "lectura", "formación"),
  icon("graduation-cap", "Educación", "colegio", "formación", "cursos"),
  icon("baby", "Bebé", "hijos", "niños"),
  icon("users", "Familia", "personas", "grupo"),
  icon("paw-print", "Mascotas", "perro", "gato", "veterinario"),
  icon("laptop", "Tecnología", "ordenador", "electrónica"),
  icon("package", "Paquete", "envíos", "compras online", "otros"),
  icon("tag", "Etiqueta", "otros", "varios", "general"),
  icon("heart", "Donaciones", "ong", "solidaridad"),
];

const ids = new Set(ICONS.map((i) => i.id));
export const isIconId = (id: string) => ids.has(id);

const fold = (s: string) => s.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");

/** Icons whose name or keywords contain every word of the query (case and accents ignored). */
export function searchIcons(query: string): IconInfo[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return ICONS;
  return ICONS.filter((i) => {
    const text = fold([i.label, ...i.keywords].join(" "));
    return words.every((w) => text.includes(w));
  });
}
