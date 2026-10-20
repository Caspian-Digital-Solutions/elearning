import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";
import {
  classifyCallbackError,
  signInErrorMessage,
  signInErrorMessages,
} from "@/lib/auth/sign-in-errors";

describe("public paths", () => {
  it("lets signed-out visitors open only the login page and the callback", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("protects every other page", () => {
    for (const path of ["/", "/my-path", "/setup-pending", "/admin/settings", "/loginx", "/auth"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});

describe("sign-in error messages", () => {
  it("shows the CDS account message when the domain lock refuses the account", () => {
    const params = new URLSearchParams({
      error: "access_denied",
      error_description: "Please sign in with your CDS Google account.",
    });
    expect(classifyCallbackError(params)).toBe("wrong-domain");
  });

  it("treats a database refusal from the profile trigger as a wrong domain", () => {
    const params = new URLSearchParams({
      error: "server_error",
      error_description: "Database error saving new user",
    });
    expect(classifyCallbackError(params)).toBe("wrong-domain");
  });

  it("treats a cancelled Google screen as not completed", () => {
    expect(classifyCallbackError(new URLSearchParams({ error: "access_denied" }))).toBe(
      "not-completed",
    );
  });

  it("returns nothing when there is no error", () => {
    expect(classifyCallbackError(new URLSearchParams({ code: "abc" }))).toBeNull();
  });

  it("never shows text from the URL, only known messages", () => {
    expect(signInErrorMessage("<script>alert(1)</script>")).toBeNull();
    expect(signInErrorMessage("toString")).toBeNull();
    expect(signInErrorMessage("wrong-domain")).toBe(signInErrorMessages["wrong-domain"]);
  });

  it("uses plain sentences without exclamation marks", () => {
    for (const message of Object.values(signInErrorMessages)) {
      expect(message).not.toContain("!");
      expect(message.endsWith(".")).toBe(true);
    }
  });
});
