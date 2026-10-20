import { afterEach, describe, expect, it, vi } from "vitest";
import { readPublicEnv } from "@/lib/env-public";

vi.mock("server-only", () => ({}));

const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

const fakeSecret = "sb_secret_test_value_that_must_never_appear";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubAll(values: Partial<Record<(typeof names)[number], string>>) {
  for (const name of names) {
    vi.stubEnv(name, values[name] ?? "");
  }
}

describe("environment check", () => {
  it("reads the public Supabase settings", () => {
    stubAll({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(readPublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
  });

  it("names every missing public variable", () => {
    stubAll({});
    expect(() => readPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL is missing/);
    expect(() => readPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing/);
  });

  it("rejects a URL that is not a full URL", () => {
    stubAll({
      NEXT_PUBLIC_SUPABASE_URL: "example.supabase",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(() => readPublicEnv()).toThrow(/must be a full URL/);
  });

  it("names a missing secret key on the server", async () => {
    stubAll({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    const { readServerEnv } = await import("@/lib/env");
    expect(() => readServerEnv()).toThrow(/SUPABASE_SECRET_KEY is missing/);
  });

  it("never puts a secret value in an error message", async () => {
    stubAll({
      NEXT_PUBLIC_SUPABASE_URL: "not a url",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeSecret,
      SUPABASE_SECRET_KEY: fakeSecret,
    });
    const { readServerEnv } = await import("@/lib/env");
    let message = "";
    try {
      readServerEnv();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(message).not.toContain(fakeSecret);
    expect(message).not.toContain("not a url");
  });
});
