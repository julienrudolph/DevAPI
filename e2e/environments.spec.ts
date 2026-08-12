import { expect, test } from "@playwright/test";

import {
  createRequest,
  createWorkspace,
  expectNoAccessibilityViolations,
  registerInNewContext,
} from "./support.js";

test("environment variables resolve into an executed request", async ({
  browser,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const context = await browser.newContext();
  const page = await registerInNewContext(
    context,
    `env-${suffix}@local.test`,
  );
  await createWorkspace(page, `Env team ${suffix}`, `Env workspace ${suffix}`);
  await createRequest(page);

  await page.getByRole("button", { name: "Umgebung erstellen" }).click();
  await page.getByLabel("Umgebungsname").fill("Test-Umgebung");
  await page
    .locator(".environment-popover")
    .getByRole("button", { name: "Speichern" })
    .click();
  await expect(page.getByLabel("Aktive Umgebung")).toHaveValue(/.+/);

  await page.getByRole("button", { name: "Variable hinzufügen" }).click();
  await page.getByLabel("Variablenname").fill("host");
  await page.getByLabel("Variablenwert").fill("example.com");
  await page
    .locator(".environment-popover")
    .getByRole("button", { name: "Speichern" })
    .click();
  await expect(page.locator(".environment-popover")).toHaveCount(0);

  await page.getByLabel("Request-URL").fill("https://{{host}}/");
  await expect(page.getByText("Variablen:")).toBeVisible();
  await expect(page.getByText("Vorschau: https://example.com/")).toBeVisible();

  await page.getByRole("button", { name: "Speichern" }).click();
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(page.getByText(/200 OK/)).toBeVisible({ timeout: 30_000 });

  await expectNoAccessibilityViolations(page);
  await context.close();
});

test("an undefined variable is flagged before sending the request", async ({
  browser,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const context = await browser.newContext();
  const page = await registerInNewContext(
    context,
    `env-missing-${suffix}@local.test`,
  );
  await createWorkspace(
    page,
    `Missing var team ${suffix}`,
    `Missing var workspace ${suffix}`,
  );
  await createRequest(page);

  await page.getByLabel("Request-URL").fill("https://{{undefinedHost}}/");
  await expect(page.getByText("Nicht definiert: undefinedHost")).toBeVisible();

  await context.close();
});
