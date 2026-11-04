/**
 * Writes, in the import format:
 * - public/importacion/demo-completo.json: a full, fictitious data set (12 months up to the month
 *   before the given date, default today), to try the app with real-looking data;
 * - public/importacion/categorias-y-tipos.json: only the starting categories and asset types, with
 *   their icons, to add to an account with «Añadir a mis datos».
 *
 *   npm run demo:generate               # up to last month
 *   npm run demo:generate -- 2026-11-04 # fixed date
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createBackup } from "@/lib/data/backup";
import { defaultCategories, DEFAULT_ASSET_TYPES } from "@/lib/data/defaults";
import { emptySnapshot } from "@/lib/data/local";
import { createSeedData } from "@/lib/data/seed";
import { todayIso } from "@/lib/domain/dates";

const today = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? todayIso();
const data = createSeedData(today, { months: 12 });
const backup = {
  _leeme:
    "Datos de demostración ficticios: 12 meses completos, con movimientos, recurrentes, hipotecas, categorías, pisos, " +
    "activos, valores, tipos de activo y carteras. Al importarlo se sustituyen TODOS tus datos.",
  ...createBackup(data, new Date(`${today}T12:00:00Z`)),
};
const file = path.resolve(__dirname, "../public/importacion/demo-completo.json");
writeFileSync(file, JSON.stringify(backup, null, 2) + "\n");
console.log(`${path.relative(process.cwd(), file)}: ${Object.entries(data).map(([k, v]) => `${v.length} ${k}`).join(", ")}`);

// Readable ids: the app turns them into UUIDs when saving to the database.
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const starter = {
  ...emptySnapshot(),
  categories: defaultCategories().map((c) => ({ id: `cat-${c.scope}-${slug(c.name)}`, ...c })),
  assetTypes: DEFAULT_ASSET_TYPES.map((t) => ({ id: `tipo-${slug(t.name)}`, ...t })),
};
const starterFile = path.resolve(__dirname, "../public/importacion/categorias-y-tipos.json");
writeFileSync(
  starterFile,
  JSON.stringify(
    {
      _leeme:
        "Categorías y tipos de activo iniciales, con iconos. Impórtalo con «Añadir a mis datos»: no borra nada y no duplica " +
        "los que ya tengas con el mismo nombre (si no tenían icono, se les pone).",
      ...createBackup(starter, new Date(`${today}T12:00:00Z`)),
    },
    null,
    2,
  ) + "\n",
);
console.log(`${path.relative(process.cwd(), starterFile)}: ${starter.categories.length} categories, ${starter.assetTypes.length} assetTypes`);
