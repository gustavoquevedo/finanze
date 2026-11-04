"use client";

import { useRouter } from "next/navigation";

/** Goes back in history (keeps list filters), or to `fallback` when opened directly. */
export function BackLink({ fallback, label = "Volver" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="text-sm font-medium text-emerald-700"
    >
      ‹ {label}
    </button>
  );
}
