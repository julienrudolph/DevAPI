import { describe, expect, it } from "vitest";

import { createWorkspaceExport } from "./workspace-export";

describe("workspace export", () => {
  it("omits identities and redacts common secret headers", () => {
    const value = createWorkspaceExport(
      {
        id: "10000000-0000-4000-8000-000000000001",
        teamId: "20000000-0000-4000-8000-000000000001",
        name: "Team API",
        role: "owner",
      },
      {
        workspaceId: "10000000-0000-4000-8000-000000000001",
        collections: [],
        folders: [],
        requests: [],
      },
      [
        {
          id: "30000000-0000-4000-8000-000000000001",
          workspaceId: "10000000-0000-4000-8000-000000000001",
          collectionId: null,
          folderId: null,
          name: "Health",
          method: "GET",
          url: "https://example.test",
          queryParams: [],
          headers: [
            {
              id: "40000000-0000-4000-8000-000000000001",
              key: "Authorization",
              value: "Bearer secret",
              enabled: true,
            },
          ],
          body: { type: "none" },
          version: 1,
          createdBy: "50000000-0000-4000-8000-000000000001",
          updatedBy: "50000000-0000-4000-8000-000000000001",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    );

    expect(JSON.stringify(value)).not.toContain("Bearer secret");
    expect(JSON.stringify(value)).not.toContain("createdBy");
    expect(value).toMatchObject({
      format: "relay.workspace/v1",
      workspace: {
        requests: [{ headers: [{ key: "Authorization", value: "" }] }],
      },
    });
  });
});
