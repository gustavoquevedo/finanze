import { describe, expect, it } from "vitest";
import { addMonths, dayInMonth, todayIso } from "./dates";

describe("dates", () => {
  it("shifts months across years", () => {
    expect(addMonths("2026-11", -6)).toBe("2026-05");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
  it("clamps days to the end of the month", () => {
    expect(dayInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dayInMonth("2028-02", 30)).toBe("2028-02-29");
  });
  it("uses Madrid time for today", () => {
    expect(todayIso(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
  });
});
