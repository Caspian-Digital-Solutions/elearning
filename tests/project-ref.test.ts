import { describe, expect, it } from "vitest";
import { projectRefFromSupabaseUrl } from "@/lib/supabase/project-ref";

describe("projectRefFromSupabaseUrl", () => {
  it("reads the subdomain ref", () => {
    expect(projectRefFromSupabaseUrl("https://qayhizszqgubbseevtwq.supabase.co")).toBe(
      "qayhizszqgubbseevtwq",
    );
  });

  it("returns null for non-supabase hosts", () => {
    expect(projectRefFromSupabaseUrl("https://example.com")).toBeNull();
  });
});
