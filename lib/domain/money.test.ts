import { describe, expect, it } from "vitest";
import { centsToInput, parseEuros } from "./money";

describe("parseEuros", () => {
  it.each([
    ["950", 95000],
    ["950,5", 95050],
    ["950,50", 95050],
    ["950.50", 95050],
    ["1.234,56", 123456],
    ["1.234", 123400],
    [" 12 € ", 1200],
    ["0,07", 7],
  ])("%s → %i", (input, cents) => expect(parseEuros(input)).toBe(cents));

  it.each(["", "abc", "1,234", "12,3,4", "-5", "1.5.3"])("rejects %j", (input) =>
    expect(parseEuros(input)).toBeNull(),
  );
});

describe("centsToInput", () => {
  it("formats for editing and round-trips", () => {
    expect(centsToInput(95000)).toBe("950");
    expect(centsToInput(95005)).toBe("950,05");
    for (const c of [1, 99, 100, 123456]) expect(parseEuros(centsToInput(c))).toBe(c);
  });
});
