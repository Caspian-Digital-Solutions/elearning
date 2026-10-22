import { describe, expect, it } from "vitest";
import { assertDevProjectRef, projectRefFromSupabaseUrl } from "../scripts/demo-data-guard";

describe("demo-data guard", () => {
  it("reads the project ref from a Supabase URL", () => {
    expect(projectRefFromSupabaseUrl("https://qayhizszqgubbseevtwq.supabase.co")).toBe("qayhizszqgubbseevtwq");
    expect(projectRefFromSupabaseUrl("not-a-url")).toBeNull();
  });

  it("refuses when DEV_PROJECT_REF does not match the URL", () => {
    const result = assertDevProjectRef(
      "https://abcdefghijklmnop.supabase.co",
      "qayhizszqgubbseevtwq",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Refusing to run");
    }
  });

  it("allows when refs match", () => {
    const result = assertDevProjectRef(
      "https://qayhizszqgubbseevtwq.supabase.co",
      "qayhizszqgubbseevtwq",
    );
    expect(result).toEqual({ ok: true, ref: "qayhizszqgubbseevtwq" });
  });
});
