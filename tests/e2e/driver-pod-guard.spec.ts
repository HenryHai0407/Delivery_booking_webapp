import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("driver cannot set completed status before POD upload", async ({ page }) => {
  await login(page, "driver.e2e@example.com", "driver123");
  await page.goto("/driver");

  await expect(page.getByText("bk_e2e_driver_guard")).toBeVisible();
  await page.locator("select").first().selectOption("completed");
  await page.getByRole("button", { name: "Save status" }).first().click();

  await expect(page.getByText("POD photo is required before setting status to completed.")).toBeVisible();
});
