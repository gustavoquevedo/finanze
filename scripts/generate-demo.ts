/**
 * Writes public/importacion/demo-completo.json: a full, fictitious data set (12 months up to the
 * month before `--today`, default today) in the import format, to try the app with real-looking data.
 *
 *   npm run demo:generate               # up to last month
 *   npm run demo:generate -- 2026-11-04 # fixed date
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createBackup } from "@/lib/data/backup";
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
