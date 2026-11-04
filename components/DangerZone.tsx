"use client";

import { useState } from "react";

const WORD = "BORRAR";

/**
 * Destructive action guarded by typing a word. The button stays disabled until the word matches
 * (case-insensitive, ignoring spaces around it).
 */
export function DeleteAllData({
  where,
  onBackup,
  onDelete,
}: {
  /** "de tu cuenta" / "de este navegador" */
  where: string;
  onBackup: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed.trim().toUpperCase() === WORD;

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setOpen(false);
      setTyped("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border-2 border-rose-300 bg-rose-50 p-4" aria-labelledby="danger-title">
      <h2 id="danger-title" className="font-semibold text-rose-800">Zona de peligro</h2>
      {!open ? (
        <>
          <p className="text-sm text-rose-900">Borra todos los datos {where}: movimientos, recurrentes, pisos, categorías, activos y carteras.</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-lg border-2 border-rose-600 bg-white px-4 py-3 font-semibold text-rose-700"
          >
            Borrar todos los datos…
          </button>
        </>
      ) : (
        <form onSubmit={confirm} noValidate className="space-y-3">
          <p role="alert" className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
            ⚠️ Se borrarán TODOS los datos {where}. Esta acción no se puede deshacer.
          </p>
          <p className="text-sm text-rose-900">
            Si quieres conservarlos,{" "}
            <button type="button" onClick={() => void onBackup()} className="font-semibold underline">
              descarga antes una copia
            </button>
            .
          </p>
          <div>
            <label htmlFor="danger-confirm" className="mb-1 block text-sm text-rose-900">
              Escribe <b className="font-mono">{WORD}</b> para confirmar:
            </label>
            <input
              id="danger-confirm"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-lg border-2 border-rose-300 bg-white px-3 py-3 font-mono text-base"
              placeholder={WORD}
            />
          </div>
          {error && <p className="text-sm text-rose-800">No se pudo borrar: {error}</p>}
          <button
            type="submit"
            disabled={!ready || busy}
            className="w-full rounded-lg bg-rose-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Borrando…" : "Borrar todos los datos"}
          </button>
          <button type="button" onClick={() => (setOpen(false), setTyped(""))} className="w-full py-1 text-sm font-medium text-slate-700">
            Cancelar
          </button>
        </form>
      )}
    </section>
  );
}
