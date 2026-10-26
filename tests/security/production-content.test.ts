import { afterEach, describe, expect, it } from "vitest";
import {
  blockSampleContentInProduction,
  blockSamplePromptInProduction,
  blockTestAccountInProduction,
} from "@/lib/security/production-content";

describe("production content guards", () => {
  afterEach(() => {
    delete process.env.APP_ENV;
  });

  it("blocks sample content when APP_ENV is production", () => {
    process.env.APP_ENV = "production";
    expect(blockSampleContentInProduction(true)).toMatch(/production/i);
    expect(blockSampleContentInProduction(false)).toBeNull();
  });

  it("blocks SAMPLE prompt titles when APP_ENV is production", () => {
    process.env.APP_ENV = "production";
    expect(blockSamplePromptInProduction("SAMPLE Claude drafting")).toMatch(/production/i);
    expect(blockSamplePromptInProduction("Real prompt title")).toBeNull();
  });

  it("blocks test accounts when APP_ENV is production", () => {
    process.env.APP_ENV = "production";
    expect(blockTestAccountInProduction(true)).toMatch(/Test accounts/i);
  });
});
