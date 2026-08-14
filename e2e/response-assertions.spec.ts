import { expect, test } from "@playwright/test";

import {
  createRequest,
  createWorkspace,
  expectNoAccessibilityViolations,
  registerInNewContext,
} from "./support.js";

test("response assertions evaluate and persist pass and fail states", async ({
  browser,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const context = await browser.newContext();
  const page = await registerInNewContext(
    context,
    `assertions-${suffix}@local.test`,
  );
  await createWorkspace(
    page,
    `Assertions team ${suffix}`,
    `Assertions workspace ${suffix}`,
  );
  await createRequest(page);

  await page
    .getByLabel("Request-URL")
    .fill("https://postman-echo.com/get?foo=bar");
  await page.getByRole("tab", { name: "Tests" }).click();

  await page.getByRole("button", { name: "Test hinzufügen" }).click();
  const jsonPathRow = page.locator(".assertion-row").nth(0);
  await jsonPathRow.getByLabel("JSON-Pfad", { exact: true }).fill("args.foo");

  await page.getByRole("button", { name: "Test hinzufügen" }).click();
  const statusRow = page.locator(".assertion-row").nth(1);
  await statusRow.getByLabel("Prüfungstyp").selectOption("status");

  await page.getByRole("button", { name: "Speichern" }).click();
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(page.getByText(/200 OK/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("tab", { name: "Tests (2/2)" }).click();
  await expect(page.locator(".assertion-passed")).toHaveCount(2);
  await expect(page.locator(".assertion-failed")).toHaveCount(0);
  await expect(page.getByText("args.foo existiert")).toBeVisible();
  await expect(page.getByText("Status ist 200")).toBeVisible();

  await statusRow.getByLabel("Erwarteter Status-Code").fill("404");
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(page.getByText(/200 OK/)).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("tab", { name: "Tests (1/2)" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Tests (1/2)" }).click();
  await expect(page.locator(".assertion-passed")).toHaveCount(1);
  await expect(page.locator(".assertion-failed")).toHaveCount(1);
  await expect(
    page.getByText("Status ist 200, erwartet 404"),
  ).toBeVisible();

  await expectNoAccessibilityViolations(page);
  await context.close();
});

test("saved assertions survive a full page reload", async ({ browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const context = await browser.newContext();
  const page = await registerInNewContext(
    context,
    `assertions-reload-${suffix}@local.test`,
  );
  await createWorkspace(
    page,
    `Assertions reload team ${suffix}`,
    `Assertions reload workspace ${suffix}`,
  );
  await createRequest(page);

  await page.getByLabel("Request-URL").fill("https://example.com/");
  await page.getByRole("tab", { name: "Tests" }).click();
  await page.getByRole("button", { name: "Test hinzufügen" }).click();
  await page
    .locator(".assertion-row")
    .nth(0)
    .getByLabel("Prüfungstyp")
    .selectOption("status");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("tab", { name: "Tests (1)" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("tab", { name: "Tests (1)" })).toBeVisible();

  await context.close();
});
