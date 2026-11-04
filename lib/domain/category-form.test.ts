import { describe, expect, it } from "vitest";
import { validateCategoryForm } from "./category-form";
import type { Category } from "./types";

const existing: Category[] = [{ id: "c1", name: "Reparación", type: "gasto", scope: "piso", deductible: true }];

describe("category form", () => {
  it("trims the name and builds the category", () => {
    expect(validateCategoryForm({ name: "  Muebles   y enseres ", type: "gasto", scope: "piso", deductible: true }, existing)).toEqual({
      ok: true,
      value: { name: "Muebles y enseres", type: "gasto", scope: "piso", deductible: true },
    });
  });

  it("requires a name unique within scope and type, ignoring case and accents", () => {
    const v = { name: "reparacion", type: "gasto" as const, scope: "piso" as const, deductible: false };
    expect(validateCategoryForm({ ...v, name: " " }, existing).ok).toBe(false);
    expect(validateCategoryForm(v, existing).ok).toBe(false);
    expect(validateCategoryForm(v, existing, "c1").ok).toBe(true);
    expect(validateCategoryForm({ ...v, scope: "personal" }, existing).ok).toBe(true);
  });
});
