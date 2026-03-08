import { test, expect } from "@playwright/test";

test("customer can submit booking wizard and gets ticket link modal", async ({ page }) => {
  await page.route("**://nominatim.openstreetmap.org/**", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") || "";
    const data =
      q.toLowerCase().includes("pickup")
        ? [{ lat: "60.1700", lon: "24.9400" }]
        : [{ lat: "60.1900", lon: "24.9700" }];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.route("**://router.project-osrm.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        routes: [
          {
            distance: 12000,
            duration: 1800,
            geometry: {
              coordinates: [
                [24.94, 60.17],
                [24.95, 60.175],
                [24.97, 60.19]
              ]
            }
          }
        ]
      })
    });
  });

  await page.goto("/");

  await page.getByLabel("Email for updates").fill("customer.e2e@example.com");
  await page.getByLabel("Move start time").fill("2030-01-02T10:00");
  await expect(page.getByText("This time slot is currently available.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByPlaceholder("Street, city, postal code").first().fill("Pickup Test 1");
  await page.getByPlaceholder("Street, city, postal code").nth(1).fill("Dropoff Test 2");
  await expect(page.getByText("Estimated price:")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Staff needed").fill("2");
  await page.getByRole("button", { name: "Submit booking request" }).click();

  await expect(page.getByText("Request sent successfully")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /\/portal\/bk_/ })).toBeVisible();
});
