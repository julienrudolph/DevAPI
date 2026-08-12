import { expect, test } from "@playwright/test";

import {
  createInvitation,
  createRequest,
  createWorkspace,
  expectNoAccessibilityViolations,
  registerInNewContext,
} from "./support.js";

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
  await concurrent
    .getByRole("button", { name: "Team-Version übernehmen" })
    .click();
  await expect(concurrent.getByLabel("Request-URL")).toHaveValue(
    "https://example.com/?owner=1",
  );

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
