import { describe, expect, it } from "vitest";
import { transactionsHref } from "./transactions-url";

describe("transactionsHref", () => {
  it("builds the list URL with only the given filters", () => {
    expect(transactionsHref({})).toBe("/movimientos");
    expect(transactionsHref({ mes: "2026-10", piso: "personal", categoria: "" })).toBe("/movimientos?mes=2026-10&piso=personal");
  });
});
