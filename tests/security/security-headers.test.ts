import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, securityHeadersForEnv } from "@/lib/security/headers";

describe("security headers", () => {
  it("includes frame-ancestors none and Supabase connect hosts", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("drive.google.com");
  });

  it("adds HSTS only for production https", () => {
    const prod = securityHeadersForEnv("production", true);
    expect(prod["Strict-Transport-Security"]).toContain("max-age=31536000");
    const dev = securityHeadersForEnv("development", false);
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
  });
});
