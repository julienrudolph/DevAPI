import { describe, expect, it } from "vitest";

import {
  createRequestSummarySchema,
  createWorkspaceSchema,
  updateNavigationItemSchema,
  workspaceTreeSchema,
} from "./workspace.js";

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

describe("createWorkspaceSchema", () => {
  it("accepts a new team or an existing team and rejects empty names", () => {
    expect(
      createWorkspaceSchema.parse({
        teamName: " Team ",
        workspaceName: " API ",
      }),
    ).toEqual({ teamName: "Team", workspaceName: "API" });
    expect(
      createWorkspaceSchema.parse({
        teamId: "ca310ca9-7dd9-4c67-9e03-c73cb38ca475",
        workspaceName: " Internal API ",
      }),
    ).toEqual({
      teamId: "ca310ca9-7dd9-4c67-9e03-c73cb38ca475",
      workspaceName: "Internal API",
    });
    expect(
      createWorkspaceSchema.safeParse({
        teamName: " ",
        workspaceName: "API",
      }).success,
    ).toBe(false);
  });
});

describe("createRequestSummarySchema", () => {
  it("applies safe defaults to a newly created request", () => {
    expect(
      createRequestSummarySchema.parse({
        collectionId: "95da6097-0742-4164-9c9a-75dc64d2cd8f",
        name: "List customers",
      }),
    ).toMatchObject({
      folderId: null,
      method: "GET",
      url: "https://",
    });
  });
});

describe("updateNavigationItemSchema", () => {
  it("requires a name or target position in addition to the version", () => {
    expect(updateNavigationItemSchema.safeParse({
      expectedVersion: 1,
      name: "Renamed",
    }).success).toBe(true);
    expect(updateNavigationItemSchema.safeParse({
      expectedVersion: 1,
      targetPosition: 0,
    }).success).toBe(true);
    expect(updateNavigationItemSchema.safeParse({
      expectedVersion: 1,
    }).success).toBe(false);
  });
});
