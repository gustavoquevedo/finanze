# Formato del fichero de importación

Es el mismo fichero que genera **Datos y copia → Descargar copia**, y el que se carga con **Importar**.
Ejemplo completo y válido, con datos ficticios: [`public/importacion/ejemplo-copia.json`](../../public/importacion/ejemplo-copia.json)
(desde la app: **Datos y copia → Descargar fichero de ejemplo**).

> **Importar sustituye todos los datos del navegador**: no mezcla. Descarga antes una copia de lo que tengas.

## Reglas generales

- **Importes en céntimos enteros**: 950,50 € → `95050`; 120.000 € → `12000000`. Siempre ≥ 0 (en movimientos y recurrentes, > 0: el signo lo da el tipo).
- **Fechas** `AAAA-MM-DD` (`2026-03-01`).
- **`id`**: cualquier texto único dentro de su lista (`"piso-centro"`, `"tx-0001"`…). Las referencias (`categoryId`, `propertyId`…) usan ese texto.
- **Opcionales**: si no pones un campo opcional, se usa el valor por defecto de las tablas.
- **Notas**: las claves que empiezan por `_` (`"_nota"`, `"_leeme"`) se ignoran.
- Si algo no cuadra, la importación no cambia nada y dice dónde está el error, p. ej. `Movimiento 12 (tx-0012): amount debe ser un entero en céntimos…`.

## Estructura

```json
{
  "format": "finanze-backup",
  "version": 1,
  "exportedAt": "2026-11-04T12:00:00.000Z",
  "data": {
    "properties": [], "categories": [], "transactions": [], "recurrings": [],
    "assets": [], "assetSnapshots": [], "portfolios": []
  }
}
```

`format` y `version` son obligatorios; `exportedAt` es opcional (solo se muestra). Cualquier lista de `data` puede faltar (= vacía).

## `properties` — pisos

| Campo | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `id` | sí | | |
| `name` | sí | | |
| `address` | no | `""` | |
| `purchaseDate` | sí | | Fecha de compra |
| `acquisitionPrice` | sí | | Precio de compra, céntimos, > 0 |
| `purchaseCosts` | no | `0` | Notaría, registro, ITP/IVA… (céntimos) |
| `cadastralValue` | no | `null` | Valor catastral total (recibo del IBI) |
| `constructionPercentage` | sí | | % del valor catastral que es construcción (0-100, admite decimales) |
| `active` | no | `true` | |

## `categories` — categorías

| Campo | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `id`, `name` | sí | | |
| `type` | sí | | `"ingreso"` o `"gasto"` |
| `scope` | no | `"piso"` | `"piso"` o `"personal"`: los movimientos de un piso usan categorías `piso`; los personales, `personal` |
| `deductible` | no | `false` | Deducible en la Renta |
| `notExpense` | no | `false` | Sale dinero pero **no es gasto** (capital de la hipoteca). Solo para gastos no deducibles |
| `limitedDeduction` | no | `false` | Cuenta en el límite «intereses + reparaciones ≤ ingresos». Requiere `deductible: true` |

## `transactions` — movimientos

| Campo | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `id`, `date`, `amount`, `categoryId` | sí | | `amount` > 0 en céntimos |
| `type` | no | el de la categoría | Si lo pones, debe coincidir con el de la categoría |
| `propertyId` | no | `null` | `null` = personal |
| `concept` | no | `""` | |
| `recurringId` | no | `null` | Recurrente que lo generó |
| `confirmed` | no | `true` | `false` = automático pendiente de confirmar (marca ⟳); cuenta igualmente en los totales |

Una **cuota de hipoteca** son dos movimientos: uno con la categoría de intereses y otro con la de capital.

## `recurrings` — recurrentes

Comunes:

| Campo | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `id`, `concept`, `categoryId`, `startDate` | sí | | `startDate` = primer cargo |
| `kind` | no | `"fijo"` (o `"hipoteca"` si hay `mortgage`) | |
| `propertyId` | no | `null` | `null` = personal |
| `generatedUntil` | no | fecha del último movimiento del fichero con ese `recurringId`; si no hay, `null` | Hasta qué fecha ya están creados sus movimientos. Lo posterior hasta hoy se crea al importar como **pendiente**. Con `null` se crean todos desde `startDate`. Nunca queda por detrás del último movimiento del fichero de ese recurrente, para no duplicarlo |

Importe fijo (`kind: "fijo"`):

| Campo | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `amount` | sí | | Céntimos |
| `frequency` | no | `"mensual"` | `"mensual"`, `"trimestral"` o `"anual"`. Trimestral y anual se cuentan desde el mes de `startDate` |
| `day` | no | día de `startDate` | 1-31; si el mes es más corto, el último día |
| `endDate` | no | `null` | Último cargo posible |
| `type` | no | el de la categoría | |

Hipoteca (`kind: "hipoteca"`): `categoryId` es la categoría de **intereses**. `amount`, `day`, `frequency` (mensual) y `endDate` se calculan solos.

| Campo de `mortgage` | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `principal` | sí | | Capital prestado, céntimos |
| `annualRate` | sí | | TIN fijo en %, p. ej. `2.9` |
| `installments` | sí, o `endDate` del recurrente | | Número de cuotas (o pon `endDate` = fecha de la última cuota) |
| `principalCategoryId` | sí | | Categoría del capital (normalmente con `notExpense: true`) |
| `interestMethod` | no | `"mensual"` | `"mensual"` (TIN/12), `"dias365"` o `"dias360"` (por días) |
| `adjustments` | no | `[]` | Datos del banco desde una fecha: `{ "date", "balance", "payment" }`, con `balance` (capital pendiente) y/o `payment` (cuota) en céntimos; el que no uses, `null` |

## `assets` — activos

| Campo | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `id` | sí | | |
| `kind` | sí | | `"fondo"`, `"etf"`, `"efectivo"` o `"inmobiliario"` |
| `name` | sí (no en inmobiliario) | | En inmobiliario se muestra el nombre del piso |
| `propertyId` | solo inmobiliario | `null` | Piso del activo (uno por piso). Los pisos sin activo lo reciben solo al importar |
| `active` | no | `true` | |

## `assetSnapshots` — valores de activos

| Campo | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `id`, `assetId`, `date`, `value` | sí | | `value` en céntimos. Un solo valor por activo y fecha |
| `purchaseValue` | no | `null` = el del valor anterior | Lo pagado por lo que tienes ahora; cambia con aportaciones o ventas |
| `fiscalCost` | no | `null` = el del valor anterior (o el de compra) | Coste fiscal: se mantiene en los traspasos entre fondos |

En efectivo no hay plusvalías (compra = valor). En inmobiliario, compra y coste fiscal salen del piso (precio + gastos de compra).

## `portfolios` — carteras

| Campo | Obligatorio | Por defecto | Notas |
|---|---|---|---|
| `id`, `name` | sí | | |
| `parentId` | no | `null` | Cartera que la contiene; sin ciclos |
| `assetIds` | no | `[]` | Un activo puede estar en varias carteras |

## Desde un Excel

1. Una hoja por lista (Pisos, Categorías, Movimientos…), con una columna por campo y los nombres de campo de arriba como cabecera.
2. Importes en céntimos (`=REDONDEAR(B2*100;0)`) y fechas con formato `aaaa-mm-dd` (`=TEXTO(A2;"aaaa-mm-dd")`).
3. Convierte cada hoja a JSON y pégalas dentro de `data` (o pide que te generen un conversor para tu Excel).
4. Importa: si hay errores, la app dice en qué fila y campo están.
