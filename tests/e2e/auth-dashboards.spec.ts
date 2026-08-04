import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function submitSignIn(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.locator('form button[type="submit"]').click();
}

test("signs up, confirms email, signs in, and loads borrower data", async ({ page, request }) => {
  test.skip(!process.env.E2E_AUTH_CONFIRM_URL, "Set E2E_AUTH_CONFIRM_URL to the test-only confirmation endpoint.");
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `integration.${suffix}@example.com`;
  const password = "Borrower#2026Safe";

  await page.goto("/auth");
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByPlaceholder("Joseph Banda").fill("Integration Borrower");
  await page.getByPlaceholder("+260 97 000 0000").fill("+260970000000");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("status")).toContainText(/confirm/i);

  const confirmation = await request.post(process.env.E2E_AUTH_CONFIRM_URL as string, { data: { email } });
  expect(confirmation.ok()).toBeTruthy();
  await submitSignIn(page, email, password);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("loans-card")).toBeVisible();
  await expect(page.getByTestId("applications-card")).toBeVisible();
  await expect(page.getByTestId("transactions-card")).toBeVisible();
});

test("logs in as admin and loads manager data", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.");
  await submitSignIn(page, adminEmail as string, adminPassword as string);
  await expect(page).toHaveURL(/\/manager/);
  await expect(page.getByRole("heading", { name: "Manager console" })).toBeVisible();
  await expect(page.getByTestId("applications-panel")).toBeVisible();
  await expect(page.getByTestId("admin-notifications")).toBeVisible();
});

test("expired sessions redirect to authentication instead of a blank page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.locator("form")).toBeVisible();
});