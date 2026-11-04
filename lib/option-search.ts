export interface PickerOption {
  /** `""` is the «none» option. */
  id: string;
  name: string;
  icon: string | null;
  /** Small text under the name (e.g. «Gasto · deducible»). */
  hint?: string;
}

export interface PickerGroup {
  label?: string;
  options: PickerOption[];
}

export const fold = (s: string) => s.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");

/** Groups with only the options whose name or hint contain every word (case and accents ignored); empty groups go. */
export function filterGroups(groups: PickerGroup[], query: string): PickerGroup[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups;
  return groups
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => {
        const text = fold(`${o.name} ${o.hint ?? ""}`);
        return words.every((w) => text.includes(w));
      }),
    }))
    .filter((g) => g.options.length > 0);
}

/** Options in display order (for keyboard navigation). */
export const flatten = (groups: PickerGroup[]) => groups.flatMap((g) => g.options);
