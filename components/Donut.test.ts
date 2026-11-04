import { describe, expect, it } from "vitest";
import { SERIES_COLORS, toArcs } from "./Donut";

describe("donut colours", () => {
  it("follows each slice's fixed slot, greys the uncategorised and folds slots past the palette", () => {
    const arcs = toArcs([
      { id: "rf", name: "Renta fija", value: 30, colorIndex: 1 },
      { id: "x", name: "Noveno", value: 10, colorIndex: 8 },
      { id: "none", name: "Sin tipo", value: 60, colorIndex: null },
      { id: "zero", name: "Vacío", value: 0, colorIndex: 0 },
    ]);
    expect(arcs.map((a) => [a.name, a.color])).toEqual([
      ["Renta fija", SERIES_COLORS[1]],
      ["Sin tipo", "#a3a3a3"],
      ["Otros", "#d4d4d4"],
    ]);
    expect(arcs.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1);
  });

  it("assigns by position when no slot is given, folding past 8", () => {
    const arcs = toArcs(Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: String(i), value: 10 - i })));
    expect(arcs).toHaveLength(8);
    expect(arcs[0].color).toBe(SERIES_COLORS[0]);
    expect(arcs.at(-1)!.name).toBe("Otros");
  });
});
