import { afterEach, describe, expect, it } from "vitest";
import { isPreLaunchDatabase } from "@/lib/system/pre-launch";

const envKeys = [
  "APP_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "DEV_PROJECT_REF",
  "SUPABASE_PROD_PROJECT_REF",
] as const;

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    saved[key] = process.env[key];
  }
  return saved;
}

function restoreEnv(saved: Record<string, string | undefined>) {
  for (const key of envKeys) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
}

describe("isPreLaunchDatabase", () => {
  let saved: Record<string, string | undefined>;

  afterEach(() => {
    restoreEnv(saved);
  });

  const publishable = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

  it("is false on preview deployments", () => {
    saved = saveEnv();
    process.env.APP_ENV = "preview";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://qayhizszqgubbseevtwq.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishable;
    process.env.DEV_PROJECT_REF = "qayhizszqgubbseevtwq";
    expect(isPreLaunchDatabase()).toBe(false);
  });

  it("is true when production still uses the dev ref", () => {
    saved = saveEnv();
    process.env.APP_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://qayhizszqgubbseevtwq.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishable;
    process.env.DEV_PROJECT_REF = "qayhizszqgubbseevtwq";
    process.env.SUPABASE_PROD_PROJECT_REF = "cds-academy-prod-ref";
    expect(isPreLaunchDatabase()).toBe(true);
  });

  it("is false when production uses the production ref", () => {
    saved = saveEnv();
    process.env.APP_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prodref123.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishable;
    process.env.DEV_PROJECT_REF = "qayhizszqgubbseevtwq";
    process.env.SUPABASE_PROD_PROJECT_REF = "prodref123";
    expect(isPreLaunchDatabase()).toBe(false);
  });
});
