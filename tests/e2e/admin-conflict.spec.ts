import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("admin sees schedule conflict when saving overlapping slot", async ({ page }) => {
  await login(page, "admin.e2e@example.com", "admin123");
  await page.goto("/admin");

  await page.getByPlaceholder("Public ID contains...").fill("bk_e2e_conflict_b");
  await page.getByRole("button", { name: "Apply filters" }).click();

  await expect(page.getByText("bk_e2e_conflict_b")).toBeVisible();

  const scheduleInputs = page.locator('input[placeholder="Scheduled start"]');
  await scheduleInputs.first().fill("2030-01-01T10:00");
  const scheduleEndInputs = page.locator('input[placeholder="Scheduled end"]');
  await scheduleEndInputs.first().fill("2030-01-01T12:00");

  await page.getByRole("button", { name: "Save details" }).first().click();

  await expect(page.getByText(/Schedule conflict/i)).toBeVisible({ timeout: 10_000 });
});
