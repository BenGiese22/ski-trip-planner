import { expect, test } from "@playwright/test";
import { TEST_ADMIN_PASSCODE, databaseUrl, truncateAll } from "./database";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

const passcodeField = "Passcode";
const submit = /show me the responses/i;

test("the dashboard is hidden until the passcode is given", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByLabel(passcodeField)).toBeVisible();
  await expect(page.getByTestId("admin-dashboard")).toBeHidden();
  // Nothing about anyone's response should reach the page before the gate.
  await expect(page.getByRole("button", { name: /sign out/i })).toBeHidden();
});

test("a wrong passcode is refused and sets no cookie", async ({ page }) => {
  await page.goto("/admin");

  await page.getByLabel(passcodeField).fill("definitely-not-it");
  await page.getByRole("button", { name: submit }).click();

  await expect(page.getByText(/incorrect passcode/i)).toBeVisible();
  await expect(page.getByTestId("admin-dashboard")).toBeHidden();

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "ski_trip_admin")).toBeUndefined();
});

test("the right passcode opens the dashboard", async ({ page }) => {
  await page.goto("/admin");

  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();

  await expect(page.getByTestId("admin-dashboard")).toBeVisible();
  await expect(page.getByLabel(passcodeField)).toBeHidden();
});

test("the admin cookie is httpOnly and scoped to /admin", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  const cookie = (await page.context().cookies()).find((c) => c.name === "ski_trip_admin");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  // Scoped so it is never attached to a guest's page load.
  expect(cookie?.path).toBe("/admin");
  expect(await page.evaluate(() => document.cookie)).not.toContain("ski_trip_admin");
});

test("the session survives a reload, and sign out ends it", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByLabel(passcodeField)).toBeVisible();
  await expect(page.getByTestId("admin-dashboard")).toBeHidden();
});

// The admin cookie must not double as a guest identity, or vice versa.
test("an admin session grants no guest identity", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: /start my response/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeHidden();
});

// §14 puts throttling in this phase specifically, on the route with the
// actual sensitive surface.
test("repeated wrong passcodes get rate limited", async ({ page, request }) => {
  await page.goto("/admin");

  // Drive the API directly: the limit is per-IP per window, and going through
  // the form would just be a slower way to make the same six requests.
  let sawLimit = false;
  for (let i = 0; i < 8; i++) {
    const res = await request.post("/api/admin/login", {
      data: { passcode: `wrong-${i}` },
      failOnStatusCode: false,
    });
    if (res.status() === 429) {
      sawLimit = true;
      expect(res.headers()["retry-after"]).toBeTruthy();
      break;
    }
    expect(res.status()).toBe(401);
  }
  expect(sawLimit).toBe(true);

  // And the correct passcode is refused too while the window is open —
  // otherwise the limit would be trivially bypassed by guessing correctly.
  const afterLimit = await request.post("/api/admin/login", {
    data: { passcode: TEST_ADMIN_PASSCODE },
    failOnStatusCode: false,
  });
  expect(afterLimit.status()).toBe(429);
});
