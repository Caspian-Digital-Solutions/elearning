import { describe, expect, it } from "vitest";
import { slugifyTitle, validateSlug } from "@/lib/content/slug";

describe("content slugs", () => {
  it("slugifies titles", () => {
    expect(slugifyTitle("Hello World")).toBe("hello-world");
  });

  it("rejects uppercase slugs", () => {
    expect(validateSlug("Hello").ok).toBe(false);
  });

  it("rejects reserved words", () => {
    expect(validateSlug("admin").ok).toBe(false);
  });

  it("rejects double hyphens from manual input", () => {
    expect(validateSlug("a--b").ok).toBe(false);
  });
});
