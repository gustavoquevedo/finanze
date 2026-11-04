import { describe, expect, it } from "vitest";
import { filterGroups, flatten } from "./option-search";

const groups = [
  { label: "Ingresos", options: [{ id: "a", name: "Alquiler", icon: "key" }, { id: "n", name: "Nómina", icon: null }] },
  { label: "Gastos", options: [{ id: "r", name: "Reparaciones y conservación", icon: "wrench", hint: "Gasto · deducible" }] },
];

describe("filterGroups", () => {
  it("matches names and hints ignoring case and accents, dropping empty groups", () => {
    expect(filterGroups(groups, "NOMINA")).toEqual([{ label: "Ingresos", options: [groups[0].options[1]] }]);
    expect(flatten(filterGroups(groups, "deducible conserv")).map((o) => o.id)).toEqual(["r"]);
    expect(filterGroups(groups, "  ")).toBe(groups);
    expect(filterGroups(groups, "zzz")).toEqual([]);
  });
});
