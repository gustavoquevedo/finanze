# Finanzas y pisos

App web personal para controlar mis ingresos y gastos, y la rentabilidad de los pisos que tengo alquilados. Un único usuario (yo), uso sobre todo desde el móvil. Interfaz en español.

## Stack
- Next.js (App Router) + TypeScript estricto + Tailwind CSS
- Despliegue en Vercel (preview por PR, producción desde `main`)
- Datos: fase 1 en `localStorage`; fase 2 en Supabase (Postgres + Auth + RLS)
- Tests: Vitest para lógica de dominio (cálculos, recurrentes, resúmenes)

## Comandos
- `npm run dev` · `npm run build` · `npm run lint` · `npm test`
- Antes de abrir un PR: lint, tests y build deben pasar.

## Arquitectura (regla principal)
- Toda lectura/escritura de datos pasa por la capa `lib/data/`. Los componentes NUNCA acceden a `localStorage` ni a Supabase directamente.
- `lib/data/repository.ts` define la interfaz (async). Implementaciones: `local.ts` (fase 1) y `supabase.ts` (fase 2). Cambiar de una a otra debe tocar solo la configuración.
- Los tipos del dominio viven en `lib/domain/types.ts` y reflejan el esquema SQL de `supabase/schema.sql`.
- La lógica de cálculo (rentabilidad, resúmenes, generación de recurrentes) va en `lib/domain/`, como funciones puras y con tests.

## Modelo de datos
- **Piso**: id, nombre, dirección, fecha de compra, precio de adquisición, % del valor catastral que corresponde a construcción (para la amortización), activo.
- **Categoría**: id, nombre, tipo (`ingreso` | `gasto`), ámbito (`personal` | `piso`), si es deducible en la Renta.
- **Movimiento**: id, fecha, importe, tipo (`ingreso` | `gasto`), categoría, piso (opcional: sin piso = personal), concepto, recurrente de origen (opcional).
- **Recurrente**: id, concepto, importe, categoría, piso (opcional), frecuencia (mensual | trimestral | anual), día, fecha de inicio y de fin (opcional). Genera los movimientos de cada periodo; los movimientos generados se pueden editar.
- **Hipoteca**: cada cuota se guarda como dos movimientos, intereses y amortización de capital, porque solo los intereses son gasto deducible. El reparto se puede editar por mes.

Categorías iniciales de pisos: Alquiler (ingreso), Intereses hipoteca, Amortización capital hipoteca (no es gasto), IBI, Comunidad, Seguro hogar, Seguro impago, Reparaciones y conservación, Suministros, Tasa de basuras, Gestoría, Otros.

## Funciones de la primera versión
1. Movimientos: alta, edición, borrado, listado filtrable por mes, piso y categoría.
2. Recurrentes: gestión y generación automática de movimientos.
3. Dashboard por piso: ingresos, gastos y neto, mensual y anual; también el total personal y el global.
4. Resumen para la Renta: por piso y año, total de rentas y de cada gasto deducible, más una amortización orientativa (3% del valor de construcción). Mostrar un aviso de que es orientativo y no sustituye a un asesor.

Fuera de alcance por ahora: importar CSV, varias cuentas con saldos, multiusuario.

## Convenciones
- Importes siempre en céntimos (enteros). Formato `es-ES` con € solo al mostrar.
- Fechas en ISO (`YYYY-MM-DD`); zona horaria Europe/Madrid.
- Mobile-first: todo debe usarse cómodamente a 375px de ancho.
- Componentes pequeños; sin librerías de UI pesadas. Antes de añadir una dependencia, justificarla en el PR.
- Código y nombres en inglés; textos de la interfaz en español.

## Seguridad y datos
- Nunca subir secretos al repo: usar variables de entorno (`.env.local` está en `.gitignore`; claves en Vercel).
- Los datos de prueba (`lib/data/seed.ts`) deben ser ficticios.
- Fase 2: login obligatorio y RLS en todas las tablas (cada fila con `user_id` = `auth.uid()`).

## Forma de trabajar
- Una tarea por PR, con descripción breve de qué cambia y cómo probarlo en la preview.
- Si algo de este archivo es ambiguo, preguntar antes de inventar.
