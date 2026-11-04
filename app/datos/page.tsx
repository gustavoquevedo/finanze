"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { DeleteAllData } from "@/components/DangerZone";
import { buildInfo } from "@/lib/supabase/client";
import {
  browserData,
  dataMode,
  deleteAllData,
  addBackup,
  exportBackup,
  importBackup,
  lastBackupAt,
  parseBackup,
  restoreSeedData,
  uploadBrowserData,
  type BackupSummary,
  type ParsedBackup,
} from "@/lib/data";

// Typed by the backup sections, so a new section without a label fails to compile.
const LABELS: Record<keyof BackupSummary, string> = {
  transactions: "movimientos",
  recurrings: "recurrentes",
  categories: "categorías",
  properties: "pisos",
  assetTypes: "tipos de activo",
  assets: "activos",
  assetSnapshots: "valores de activos",
  portfolios: "carteras",
};

/** «2 pisos · 207 movimientos…», leaving out empty sections. */
const describe = (summary: BackupSummary) =>
  Object.entries(summary)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${LABELS[k as keyof BackupSummary]}`)
    .join(" · ") || "Sin datos";

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DataPage() {
  const [last, setLast] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { email, signOut } = useAuth();
  const cloud = dataMode === "supabase";
  const [local, setLocal] = useState<BackupSummary | null>(null);

  useEffect(() => {
    setLast(lastBackupAt());
    if (cloud) void browserData().then((d) => setLocal(d?.summary ?? null));
    const probe = new File(["{}"], "x.json", { type: "application/json" });
    setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
  }, [cloud]);

  async function handleExport(share: boolean) {
    setMessage(null);
    const { fileName, text } = await exportBackup();
    setLast(lastBackupAt());
    if (share) {
      try {
        await navigator.share({ files: [new File([text], fileName, { type: "application/json" })], title: "Copia de Finanzas y pisos" });
        return;
      } catch (e) {
        // Cancelled by the user: nothing else to do.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    download(fileName, text);
  }

  async function handleFile(file: File | undefined) {
    setMessage(null);
    setFileName(file?.name ?? null);
    if (!file) return setParsed(null);
    setParsed(parseBackup(await file.text()));
  }

  function resetFile() {
    setParsed(null);
    setFileName(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleImport() {
    if (!parsed?.ok) return;
    if (!window.confirm(`Se sustituirán TODOS los datos ${cloud ? "de tu cuenta" : "de este navegador"} por los de la copia. ¿Continuar?`)) return;
    setBusy(true);
    try {
      await importBackup(parsed.data);
      resetFile();
      setMessage("Copia importada.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!parsed?.ok) return;
    setBusy(true);
    try {
      const { added, reused } = await addBackup(parsed.data);
      resetFile();
      const parts = Object.entries(added)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${LABELS[k as keyof BackupSummary]}`);
      const same = reused.categories + reused.assetTypes;
      setMessage(
        `Añadido: ${parts.length ? parts.join(" · ") : "nada nuevo"}.` +
          (same
            ? same === 1
              ? " 1 categoría o tipo ya existía y se ha reutilizado."
              : ` ${same} categorías o tipos ya existían y se han reutilizado.`
            : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    if (!window.confirm("Se sustituirán TODOS los datos de tu cuenta por los de este navegador. ¿Continuar?")) return;
    setBusy(true);
    try {
      await uploadBrowserData();
      setMessage("Datos de este navegador subidos a tu cuenta.");
    } catch (e) {
      setMessage(`No se pudieron subir: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (!window.confirm("Se borrarán todos los datos y se cargarán los datos de prueba. ¿Continuar?")) return;
    setBusy(true);
    try {
      await restoreSeedData();
      setMessage("Datos de prueba restaurados.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Datos y copia de seguridad</h1>
      {cloud ? (
        <section className="space-y-2 rounded-xl bg-white p-4 text-sm shadow-sm">
          <p>
            Tus datos se guardan en tu cuenta{email && <> (<b>{email}</b>)</>} y los ves igual en todos tus dispositivos.
          </p>
          <button type="button" onClick={() => void signOut()} className="font-medium text-rose-700">
            Cerrar sesión
          </button>
        </section>
      ) : (
        <div className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>Por ahora los datos se guardan solo en este navegador. Haz copias a menudo: si se borran los datos del navegador, se pierden.</p>
          {/* Diagnosis for the Supabase setup: shows whether this build got each variable (not their values). */}
          <p className="text-xs text-amber-800">
            Supabase en esta versión: URL {buildInfo.hasUrl ? (buildInfo.urlLooksRight ? "✓" : "⚠ formato raro") : "✗"} · clave{" "}
            {buildInfo.hasKey ? "✓" : "✗"}
            {buildInfo.commit && <> · versión {buildInfo.commit}</>}
          </p>
        </div>
      )}

      {cloud && local && (
        <section className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <h2 className="font-semibold">Datos de este navegador</h2>
          <p className="text-sm text-slate-700">
            Este navegador tiene datos de antes de usar la cuenta: {describe(local)}. Puedes subirlos a tu cuenta (sustituyen lo que
            haya en ella).
          </p>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={busy}
            className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            Subir estos datos a mi cuenta
          </button>
        </section>
      )}
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Exportar</h2>
        <p className="text-sm text-slate-600">
          Descarga un archivo con todos tus datos. Sirve como copia y para pasar los datos a otro dispositivo.
        </p>
        <p className="text-xs text-slate-500">{last ? `Última copia desde este navegador: ${when(last)}.` : "Aún no has hecho ninguna copia desde este navegador."}</p>
        <button type="button" onClick={() => void handleExport(false)} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white">
          Descargar copia
        </button>
        {canShare && (
          <button type="button" onClick={() => void handleExport(true)} className="w-full rounded-lg border border-emerald-700 px-4 py-3 font-medium text-emerald-700">
            Compartir copia…
          </button>
        )}
      </section>

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Importar</h2>
        <p className="text-sm text-slate-600">
          Añade a tus datos lo que haya en un fichero, o sustituye con él todos los datos {cloud ? "de tu cuenta" : "de este navegador"}.
        </p>
        <p className="text-xs text-slate-500">
          ¿Vas a preparar el fichero desde otra fuente, como un Excel?{" "}
          <a href="/importacion/ejemplo-copia.json" download className="font-medium text-emerald-700 underline">
            Descargar fichero de ejemplo
          </a>{" "}
          con todos los tipos de datos y notas en cada campo.
        </p>
        <p className="text-xs text-slate-500">
          ¿Quieres ver la app con un año de datos?{" "}
          <a href="/importacion/demo-completo.json" download className="font-medium text-emerald-700 underline">
            Descargar datos de demostración
          </a>{" "}
          (ficticios) e impórtalos aquí.
        </p>
        <p className="text-xs text-slate-500">
          ¿Solo quieres las categorías y los tipos de activo iniciales, con sus iconos?{" "}
          <a href="/importacion/categorias-y-tipos.json" download className="font-medium text-emerald-700 underline">
            Descargar categorías y tipos
          </a>{" "}
          e impórtalos con «Añadir a mis datos».
        </p>
        {/* The native file button is in the browser's language: use our own label instead. */}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm">
          <span className="rounded-md bg-slate-100 px-3 py-1.5 font-medium">Elegir archivo…</span>
          <span className="min-w-0 truncate text-slate-500">{fileName ?? "Ningún archivo elegido"}</span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleFile(e.target.files?.[0])}
            className="sr-only"
            aria-label="Archivo de copia"
          />
        </label>
        {parsed && !parsed.ok && <p className="whitespace-pre-line text-sm text-rose-700">{parsed.error}</p>}
        {parsed?.ok && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              <p className="font-medium">{parsed.exportedAt ? `Copia del ${when(parsed.exportedAt)}` : "Copia sin fecha"}</p>
              <p>{describe(parsed.summary)}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={busy}
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              Añadir a mis datos
            </button>
            <p className="text-xs text-slate-500">
              No borra nada. Las categorías y tipos con el mismo nombre se reutilizan (sin duplicarlos); el resto se añade como nuevo.
            </p>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={busy}
              className="w-full rounded-lg border-2 border-rose-600 bg-white px-4 py-3 font-medium text-rose-700 disabled:opacity-50"
            >
              Sustituir todos mis datos por esta copia
            </button>
            <p className="text-xs text-slate-500">Borra lo que tienes ahora. Consejo: descarga antes una copia.</p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-dashed border-slate-300 p-4">
        <h2 className="font-semibold">Datos de prueba</h2>
        <p className="text-sm text-slate-600">Borra todo y carga datos ficticios para probar la app.</p>
        <button
          type="button"
          onClick={() => void handleRestore()}
          disabled={busy}
          className="w-full rounded-lg bg-slate-800 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          Restaurar datos de prueba
        </button>
      </section>

      <DeleteAllData
        where={cloud ? "de tu cuenta" : "de este navegador"}
        onBackup={() => handleExport(false)}
        onDelete={async () => {
          await deleteAllData();
          setMessage("Se han borrado todos los datos.");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
