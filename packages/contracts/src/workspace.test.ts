import { describe, expect, it } from "vitest";

import { workspaceTreeSchema } from "./workspace.js";

describe("workspaceTreeSchema", () => {
  it("accepts a flat, versioned navigation tree", () => {
    expect(
      workspaceTreeSchema.safeParse({
        workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
        collections: [],
        folders: [],
        requests: [
          {
            id: "3ac6a7df-5e80-427d-a6e4-d48427ac924d",
            workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
            collectionId: null,
            folderId: null,
            name: "Health",
            method: "GET",
            version: 1,
          },
        ],
      }).success,
    ).toBe(true);
  });
});
