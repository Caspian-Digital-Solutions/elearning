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

for (const path of [
  "/help",
  "/help/data-rules",
  "/what-changed",
  "/lessons",
  "/lessons/f1",
  "/content-image/x.png",
  "/trainer/content",
  "/trainer/users",
  "/admin/roles",
  "/admin/settings",
  "/admin/audit",
]) {
  test(`a signed-out visit to ${path} lands on the sign-in page`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  });
}

test("a signed-out request for the audit log export gets the sign-in page, not data", async ({ page }) => {
  await page.goto("/admin/audit/export");
  await expect(page).toHaveURL(/\/login$/);
});

test("a signed-out visit to the paused-access page lands on the sign-in page", async ({ page }) => {
  await page.goto("/access-paused");
  await expect(page).toHaveURL(/\/login$/);
});

test("the sign-in page explains a refused account in plain English", async ({ page }) => {
  await page.goto("/login?error=wrong-domain");
  await expect(
    page.getByRole("alert").filter({ hasText: "Please sign in with your CDS Google account." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
});
