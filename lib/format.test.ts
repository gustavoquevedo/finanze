import { describe, expect, it } from "vitest";
import { describeSchedule } from "./format";

describe("describeSchedule", () => {
  it("describes each frequency in Spanish", () => {
    expect(describeSchedule({ frequency: "mensual", day: 4, startDate: "2026-01-04" })).toBe("Cada mes, día 4");
    expect(describeSchedule({ frequency: "trimestral", day: 1, startDate: "2026-03-01" })).toBe("Cada 3 meses (desde marzo), día 1");
    expect(describeSchedule({ frequency: "anual", day: 1, startDate: "2026-07-01" })).toBe("Cada año, 1 de julio");
    expect(describeSchedule({ frequency: "anual", day: 31, startDate: "2026-03-31" })).toBe("Cada año, 31 de marzo");
  });
});
