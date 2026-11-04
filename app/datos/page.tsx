"use client";

import { useEffect, useRef, useState } from "react";
import { exportBackup, importBackup, lastBackupAt, parseBackup, restoreSeedData, type ParsedBackup } from "@/lib/data";

const LABELS: Record<string, string> = {
  transactions: "movimientos",
  recurrings: "recurrentes",
  categories: "categorías",
  properties: "pisos",
  assets: "activos",
  assetSnapshots: "valores de activos",
  portfolios: "carteras",
};

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

  useEffect(() => {
    setLast(lastBackupAt());
    const probe = new File(["{}"], "x.json", { type: "application/json" });
    setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
  }, []);

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

  async function handleImport() {
    if (!parsed?.ok) return;
    if (!window.confirm("Se sustituirán TODOS los datos de este navegador por los de la copia. ¿Continuar?")) return;
    setBusy(true);
    try {
      await importBackup(parsed.data);
      setParsed(null);
      setFileName(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessage("Copia importada.");
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
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Por ahora los datos se guardan solo en este navegador. Haz copias a menudo: si se borran los datos del navegador, se pierden.
      </p>
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Exportar</h2>
        <p className="text-sm text-slate-600">
          Descarga un archivo con todos tus datos. Sirve como copia y para pasar los datos a otro dispositivo.
        </p>
        <p className="text-xs text-slate-500">{last ? `Última copia desde este navegador: ${when(last)}.` : "Aún no has hecho ninguna copia."}</p>
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
        <p className="text-sm text-slate-600">Sustituye todos los datos de este navegador por los de una copia.</p>
        <p className="text-xs text-slate-500">
          ¿Vas a preparar el fichero desde otra fuente, como un Excel?{" "}
          <a href="/importacion/ejemplo-copia.json" download className="font-medium text-emerald-700 underline">
            Descargar fichero de ejemplo
          </a>{" "}
          con todos los tipos de datos y notas en cada campo.
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
              <p>
                {Object.entries(parsed.summary)
                  .map(([k, n]) => `${n} ${LABELS[k]}`)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={busy}
              className="w-full rounded-lg bg-rose-700 px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              Sustituir mis datos por esta copia
            </button>
            <p className="text-xs text-slate-500">Consejo: descarga antes una copia de lo que tienes ahora.</p>
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
    </div>
  );
}
