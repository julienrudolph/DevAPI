import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const password = "Relay-E2E-Password-2026!";

async function expectNoAccessibilityViolations(page: Page): Promise<void> {
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

async function register(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: "Registrieren" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/($|workspaces\/)/);
}

async function createWorkspace(
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

async function createRequest(page: Page): Promise<void> {
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

async function registerInNewContext(
  context: BrowserContext,
  email: string,
): Promise<Page> {
  const page = await context.newPage();
  await register(page, email);
  return page;
}

async function createInvitation(page: Page, role: "editor" | "viewer") {
  await page.getByRole("button", { name: "Einladen" }).click();
  await page.getByLabel("Rolle").selectOption(role);
  await page.getByRole("button", { name: "Link erstellen" }).click();
  const invitationUrl = await page.getByLabel("Einladungslink").inputValue();
  await page.getByRole("button", { name: "Fertig" }).click();
  return invitationUrl;
}

test("collaborative workspace, conflict, roles, and tenant isolation", async ({
  browser,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerContext = await browser.newContext();
  const owner = await registerInNewContext(
    ownerContext,
    `owner-${suffix}@local.test`,
  );
  await createWorkspace(owner, `Team ${suffix}`, `Workspace ${suffix}`);
  const ownerWorkspaceUrl = owner.url();
  await createRequest(owner);
  await expectNoAccessibilityViolations(owner);

  await owner.getByLabel("Request-URL").fill("https://example.com/");
  await owner.getByRole("button", { name: "Speichern" }).click();
  await expect(owner.getByText(/Version 2 gespeichert/)).toBeVisible();
  await owner.getByRole("button", { name: "Senden" }).click();
  await expect(owner.getByText(/200 OK/)).toBeVisible({ timeout: 30_000 });

  const editorInvitationUrl = await createInvitation(owner, "editor");
  const editorContext = await browser.newContext();
  const concurrent = await registerInNewContext(
    editorContext,
    `editor-${suffix}@local.test`,
  );
  await concurrent.goto(editorInvitationUrl);
  await concurrent
    .getByRole("button", { name: "Einladung annehmen" })
    .click();
  await concurrent
    .getByRole("button", { name: "GET Health", exact: true })
    .click();
  await expect(concurrent.getByLabel("Request-URL")).toHaveValue(
    "https://example.com/",
  );
  await owner.getByLabel("Request-URL").fill("https://example.com/?owner=1");
  await concurrent
    .getByLabel("Request-URL")
    .fill("https://example.com/?concurrent=1");
  await owner.getByRole("button", { name: "Speichern" }).click();
  await expect(owner.getByText(/Version 3 gespeichert/)).toBeVisible();
  await concurrent.getByRole("button", { name: "Speichern" }).click();
  await expect(
    concurrent.getByRole("heading", {
      name: "Request wurde zwischenzeitlich geändert",
    }),
  ).toBeVisible();

  const invitationUrl = await createInvitation(owner, "viewer");

  const viewerContext = await browser.newContext();
  const viewer = await registerInNewContext(
    viewerContext,
    `viewer-${suffix}@local.test`,
  );
  await viewer.goto(invitationUrl);
  await viewer.getByRole("button", { name: "Einladung annehmen" }).click();
  await viewer
    .getByRole("button", { name: "GET Health", exact: true })
    .click();
  await expect(viewer.getByRole("button", { name: "Senden" })).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Speichern" }),
  ).toHaveCount(0);

  const outsiderContext = await browser.newContext();
  const outsider = await registerInNewContext(
    outsiderContext,
    `outsider-${suffix}@local.test`,
  );
  await createWorkspace(
    outsider,
    `Other team ${suffix}`,
    `Other workspace ${suffix}`,
  );
  await outsider.goto(ownerWorkspaceUrl);
  await expect(outsider.getByText(`Workspace ${suffix}`)).toHaveCount(0);
  await expect(outsider.getByLabel("Workspace auswählen")).toContainText(
    `Other workspace ${suffix}`,
  );

  await outsiderContext.close();
  await viewerContext.close();
  await editorContext.close();
  await ownerContext.close();
});
