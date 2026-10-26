import { expect, test } from "@playwright/test";

test("a signed-out visit to My path lands on the sign-in page", async ({ page }) => {
  await page.goto("/my-path");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("a signed-out visit to any other page also lands on the sign-in page", async ({ page }) => {
  for (const path of ["/", "/trainer/marking", "/assignments", "/admin/settings", "/setup-pending"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

for (const path of [
  "/assignments",
  "/help",
  "/help/data-rules",
  "/what-changed",
  "/lessons",
  "/lessons/f1",
  "/assessments",
  "/assessments/week0",
  "/assessments/f3-safety-sample",
  "/content-image/x.png",
  "/trainer/content",
  "/trainer/placements",
  "/trainer/users",
  "/admin/roles",
  "/admin/settings",
  "/admin/audit",
  "/admin/system",
  "/progress",
  "/prompt-library",
  "/skills",
]) {
  test(`a signed-out visit to ${path} lands on the sign-in page`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  });
}

test("a signed-out request for a submission file gets the sign-in page, not file bytes", async ({ page }) => {
  const response = await page.goto(
    "/submission-file/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/sample.pdf",
  );
  await expect(page).toHaveURL(/\/login$/);
  expect(response?.headers()["content-type"] ?? "").not.toMatch(/application\/pdf/);
});

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
