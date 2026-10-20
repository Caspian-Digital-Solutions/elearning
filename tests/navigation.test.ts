import { describe, expect, it } from "vitest";
import { filterNavigation, navigation } from "@/config/navigation";

describe("navigation filter", () => {
  it("hides trainer and admin items from a learner", () => {
    const visible = filterNavigation(navigation, "learner");
    const hrefs = visible.map((item) => item.href);

    expect(hrefs).toContain("/my-path");
    expect(hrefs.some((href) => href.startsWith("/trainer"))).toBe(false);
    expect(hrefs.some((href) => href.startsWith("/admin"))).toBe(false);
    expect(visible.some((item) => item.group === "trainer" || item.group === "admin")).toBe(
      false,
    );
  });

  it("shows a champion only the marking queue in the trainer area", () => {
    const visible = filterNavigation(navigation, "champion");
    const trainer = visible.filter((item) => item.group === "trainer");

    expect(trainer.map((item) => item.href)).toEqual(["/trainer/marking"]);
    expect(visible.some((item) => item.group === "admin")).toBe(false);
    expect(visible.some((item) => item.href === "/my-path")).toBe(true);
  });
});
