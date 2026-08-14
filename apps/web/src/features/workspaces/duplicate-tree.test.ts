import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchRequest } from "../requests/request-api";
import { duplicateCollection, duplicateFolder } from "./duplicate-tree";
import { createCollection, createFolder, createRequest } from "./workspace-api";

vi.mock("../requests/request-api", () => ({
  fetchRequest: vi.fn(),
}));
vi.mock("./workspace-api", () => ({
  createCollection: vi.fn(),
  createFolder: vi.fn(),
  createRequest: vi.fn(),
}));

const workspaceId = "85e52968-22cc-483d-b6a6-bdc169e46ede";
const collectionId = "95da6097-0742-4164-9c9a-75dc64d2cd8f";
const rootFolderId = "b1eab850-761b-4530-9c4c-ee22c42d39bb";
const nestedFolderId = "f48c8753-c539-48b8-8ca9-553c72476dbc";
const topRequestId = "fa7596b3-0041-4fe8-9ddf-956e7a107014";
const nestedRequestId = "a5acefdb-0b49-43d7-83dc-f3ec414aa501";
const deepRequestId = "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8";

const collection = {
  id: collectionId,
  workspaceId,
  name: "Customers",
  position: 0,
  version: 1,
};

const tree = {
  folders: [
    {
      id: rootFolderId,
      workspaceId,
      collectionId,
      parentFolderId: null,
      name: "Mutations",
      position: 0,
      version: 1,
    },
    {
      id: nestedFolderId,
      workspaceId,
      collectionId,
      parentFolderId: rootFolderId,
      name: "Admin",
      position: 0,
      version: 1,
    },
  ],
  requests: [
    {
      id: topRequestId,
      workspaceId,
      collectionId,
      folderId: null,
      name: "List customers",
      method: "GET" as const,
      url: "https://api.example.com/customers",
      version: 1,
    },
    {
      id: nestedRequestId,
      workspaceId,
      collectionId,
      folderId: rootFolderId,
      name: "Create customer",
      method: "POST" as const,
      url: "https://api.example.com/customers",
      version: 1,
    },
    {
      id: deepRequestId,
      workspaceId,
      collectionId,
      folderId: nestedFolderId,
      name: "Delete customer",
      method: "DELETE" as const,
      url: "https://api.example.com/customers/:id",
      version: 1,
    },
  ],
};

const fullRequestsById: Record<string, unknown> = {
  [topRequestId]: {
    id: topRequestId,
    name: "List customers",
    method: "GET",
    url: "https://api.example.com/customers",
    queryParams: [],
    headers: [],
    body: { type: "none" },
    assertions: [],
  },
  [nestedRequestId]: {
    id: nestedRequestId,
    name: "Create customer",
    method: "POST",
    url: "https://api.example.com/customers",
    queryParams: [],
    headers: [{ id: "h1", key: "Content-Type", value: "application/json", enabled: true }],
    body: { type: "json", content: "{}" },
    assertions: [],
  },
  [deepRequestId]: {
    id: deepRequestId,
    name: "Delete customer",
    method: "DELETE",
    url: "https://api.example.com/customers/:id",
    queryParams: [],
    headers: [],
    body: { type: "none" },
    assertions: [],
  },
};

afterEach(() => {
  vi.clearAllMocks();
});

function setUpMocks() {
  vi.mocked(fetchRequest).mockImplementation(
    async (requestId: string) => fullRequestsById[requestId] as never,
  );
  vi.mocked(createFolder).mockImplementation(
    async (_workspaceId, input) =>
      ({
        id: `new-${input.name}`,
        workspaceId,
        collectionId: input.collectionId,
        parentFolderId: input.parentFolderId,
        name: input.name,
        position: 0,
        version: 1,
      }) as never,
  );
  vi.mocked(createRequest).mockImplementation(
    async (_workspaceId, input) =>
      ({
        id: `new-${input.name}`,
        workspaceId,
        collectionId: input.collectionId,
        folderId: input.folderId,
        name: input.name,
        method: input.method,
        version: 1,
      }) as never,
  );
}

describe("duplicateCollection", () => {
  it("copies the collection, its folder hierarchy and every request", async () => {
    setUpMocks();
    vi.mocked(createCollection).mockResolvedValue({
      id: "new-collection",
      workspaceId,
      name: "Customers Kopie",
      position: 1,
      version: 1,
    });

    await duplicateCollection(workspaceId, collection, tree, "token");

    expect(createCollection).toHaveBeenCalledWith(
      workspaceId,
      { name: "Customers Kopie" },
      "token",
    );
    expect(createFolder).toHaveBeenNthCalledWith(
      1,
      workspaceId,
      { collectionId: "new-collection", parentFolderId: null, name: "Mutations" },
      "token",
    );
    expect(createFolder).toHaveBeenNthCalledWith(
      2,
      workspaceId,
      {
        collectionId: "new-collection",
        parentFolderId: "new-Mutations",
        name: "Admin",
      },
      "token",
    );
    expect(createRequest).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        collectionId: "new-collection",
        folderId: null,
        name: "List customers",
      }),
      "token",
    );
    expect(createRequest).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        collectionId: "new-collection",
        folderId: "new-Mutations",
        name: "Create customer",
      }),
      "token",
    );
    expect(createRequest).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        collectionId: "new-collection",
        folderId: "new-Admin",
        name: "Delete customer",
      }),
      "token",
    );
  });
});

describe("duplicateFolder", () => {
  it("copies only the folder's own subtree as a sibling", async () => {
    setUpMocks();
    const rootFolder = tree.folders[0]!;

    await duplicateFolder(workspaceId, rootFolder, tree, "token");

    expect(createFolder).toHaveBeenNthCalledWith(
      1,
      workspaceId,
      { collectionId, parentFolderId: null, name: "Mutations Kopie" },
      "token",
    );
    expect(createFolder).toHaveBeenNthCalledWith(
      2,
      workspaceId,
      { collectionId, parentFolderId: "new-Mutations Kopie", name: "Admin" },
      "token",
    );
    expect(createRequest).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        collectionId,
        folderId: "new-Mutations Kopie",
        name: "Create customer",
      }),
      "token",
    );
    expect(createRequest).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        collectionId,
        folderId: "new-Admin",
        name: "Delete customer",
      }),
      "token",
    );
    expect(createRequest).not.toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({ name: "List customers" }),
      "token",
    );
  });
});
