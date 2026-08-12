import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";

export const password = "Relay-E2E-Password-2026!";

export async function expectNoAccessibilityViolations(
  page: Page,
): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Fluent UI/Tabster uses hidden, focusable sentinels to implement its
    // keyboard focus traps. Axe treats the sentinels themselves as content,
    // although they are never exposed as application controls.
    .exclude("[data-tabster-dummy]")
    .analyze();
  expect(
    result.violations,
    result.violations
      .map(
        (violation) =>
          `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      )
      .join("\n"),
  ).toEqual([]);
}

export async function register(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: "Registrieren" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/($|workspaces\/)/);
}

export async function createWorkspace(
  page: Page,
  teamName: string,
  workspaceName: string,
): Promise<void> {
  await page.getByLabel("Teamname").fill(teamName);
  await page.getByLabel("Workspace-Name").fill(workspaceName);
  await page.getByRole("button", { name: "Workspace erstellen" }).click();
  await expect(page.getByLabel("Workspace auswählen")).toContainText(
    workspaceName,
  );
}

export async function createRequest(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Collection erstellen" }).click();
  await page.getByLabel("Collection-Name").fill("Smoke");
  await page.getByRole("button", { name: "Erstellen", exact: true }).click();
  await page.getByRole("button", { name: "Smoke Optionen" }).click();
  await page
    .getByRole("menuitem", { name: "Request in Smoke erstellen" })
    .click();
  await page.getByLabel("Request-Name").fill("Health");
  await page.getByRole("button", { name: "Erstellen", exact: true }).click();
  await expect(page.getByLabel("Request-URL")).toBeVisible();
}

export async function registerInNewContext(
  context: BrowserContext,
  email: string,
): Promise<Page> {
  const page = await context.newPage();
  await register(page, email);
  return page;
}

export async function createInvitation(
  page: Page,
  role: "editor" | "viewer",
): Promise<string> {
  await page.getByRole("button", { name: "Einladen" }).click();
  await page.getByLabel("Rolle").selectOption(role);
  await page.getByRole("button", { name: "Link erstellen" }).click();
  const invitationUrl = await page.getByLabel("Einladungslink").inputValue();
  await page.getByRole("button", { name: "Fertig" }).click();
  return invitationUrl;
}
