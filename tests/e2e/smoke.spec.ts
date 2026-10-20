import { expect, test } from "@playwright/test";

test("a signed-out visit to My path lands on the sign-in page", async ({ page }) => {
  await page.goto("/my-path");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("a signed-out visit to any other page also lands on the sign-in page", async ({ page }) => {
  for (const path of ["/", "/trainer/marking", "/admin/settings", "/setup-pending"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("the sign-in page explains a refused account in plain English", async ({ page }) => {
  await page.goto("/login?error=wrong-domain");
  await expect(
    page.getByRole("alert").filter({ hasText: "Please sign in with your CDS Google account." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
});
