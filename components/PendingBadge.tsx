/** Mark for automatic transactions that are not confirmed yet. */
export function PendingBadge() {
  return (
    <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-px text-[11px] font-medium text-amber-800">
      <span aria-hidden>⟳</span> Automático
    </span>
  );
}
