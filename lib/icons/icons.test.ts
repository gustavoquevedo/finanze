import { describe, expect, it } from "vitest";
import { ICONS, isIconId, searchIcons } from "./catalog";
import { ICON_COMPONENTS } from "./Icon";

describe("icon catalogue", () => {
  it("has a component for every icon and unique ids", () => {
    const ids = ICONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !ICON_COMPONENTS[id])).toEqual([]);
    expect(Object.keys(ICON_COMPONENTS).sort()).toEqual([...ids].sort());
    expect(isIconId("house")).toBe(true);
    expect(isIconId("nope")).toBe(false);
  });

  it("searches names and keywords ignoring case and accents", () => {
    expect(searchIcons("luz").map((i) => i.id)).toEqual(expect.arrayContaining(["zap", "plug"]));
    expect(searchIcons("SEGURO impago").map((i) => i.id)).toEqual(["shield-check"]);
    expect(searchIcons("nomina").map((i) => i.id)).toContain("briefcase");
    expect(searchIcons("").length).toBe(ICONS.length);
    expect(searchIcons("xyzzy")).toEqual([]);
  });
});
