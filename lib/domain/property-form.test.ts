import { describe, expect, it } from "vitest";
import { validatePropertyForm, type PropertyFormValues } from "./property-form";

const values = (o: Partial<PropertyFormValues> = {}): PropertyFormValues => ({
  name: " Piso Centro ", address: "Calle 1", purchaseDate: "2019-03-15", acquisitionPrice: "168.000",
  purchaseCosts: "14.280,50", cadastralValue: "", constructionPercentage: "62,5", active: true, ...o,
});

describe("property form", () => {
  it("parses euros and percentage", () => {
    expect(validatePropertyForm(values())).toEqual({
      ok: true,
      value: {
        name: "Piso Centro", address: "Calle 1", purchaseDate: "2019-03-15", acquisitionPrice: 16800000,
        purchaseCosts: 1428050, cadastralValue: null, constructionPercentage: 62.5, active: true,
      },
    });
    const r = validatePropertyForm(values({ purchaseCosts: "", cadastralValue: "96.400" }));
    expect(r.ok && r.value).toMatchObject({ purchaseCosts: 0, cadastralValue: 9640000 });
  });

  it("reports invalid fields", () => {
    const r = validatePropertyForm(values({ name: "", acquisitionPrice: "0", constructionPercentage: "120", cadastralValue: "abc", purchaseDate: "" }));
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["acquisitionPrice", "cadastralValue", "constructionPercentage", "name", "purchaseDate"]);
  });
});
