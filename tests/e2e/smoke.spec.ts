import { expect, test } from "@playwright/test";

test("home redirects to my path and main menu pages have headings", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/my-path$/);
  await expect(page.getByRole("heading", { level: 1, name: "My path" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  const hrefs = await nav.getByRole("link").evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute("href") ?? "").filter(Boolean),
  );

  expect(hrefs.length).toBeGreaterThanOrEqual(10);

  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
