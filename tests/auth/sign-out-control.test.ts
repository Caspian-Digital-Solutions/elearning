import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("header sign-out control", () => {
  it("exposes Sign out as a visible header button, not only inside a dropdown menu", () => {
    const src = readFileSync(resolve("src/components/layout/user-menu.tsx"), "utf8");
    expect(src).toContain("Sign out");
    expect(src).not.toContain("DropdownMenu");
    expect(src).toContain("signOut");
  });
});
