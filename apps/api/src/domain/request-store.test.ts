import type { ApiRequest, RequestDraft } from "@api-client/contracts";
import { describe, expect, it } from "vitest";

import { InMemoryRequestStore } from "./request-store.js";

const request: ApiRequest = {
  id: "3ac6a7df-5e80-427d-a6e4-d48427ac924d",
  workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
  collectionId: null,
  folderId: null,
  name: "List customers",
  method: "GET",
  url: "https://api.example.test/customers",
  queryParams: [],
  headers: [],
  body: { type: "none" },
  version: 2,
  createdBy: "f6057dc0-5f7f-49b2-902f-dad47859000b",
  updatedBy: "f6057dc0-5f7f-49b2-902f-dad47859000b",
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
};
const draft: RequestDraft = { ...request, name: "Customers" };
const actor = {
  id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  displayName: "Ada",
  role: "editor" as const,
};

describe("InMemoryRequestStore", () => {
  it("updates atomically and creates the previous revision", () => {
    const store = new InMemoryRequestStore([request]);
    const result = store.update({
      requestId: request.id,
      expectedVersion: 2,
      draft,
      actor,
    });
    expect(result.kind).toBe("updated");
    expect(store.requests.get(request.id)?.version).toBe(3);
    expect(store.revisions).toHaveLength(1);
    expect(store.revisions[0]?.snapshot.version).toBe(2);
  });

  it("returns a conflict without changing data or revisions", () => {
    const store = new InMemoryRequestStore([request]);
    const result = store.update({
      requestId: request.id,
      expectedVersion: 1,
      draft,
      actor,
    });
    expect(result.kind).toBe("conflict");
    expect(store.requests.get(request.id)?.version).toBe(2);
    expect(store.revisions).toHaveLength(0);
  });

  it("prevents viewers from writing", () => {
    const store = new InMemoryRequestStore([request]);
    const result = store.update({
      requestId: request.id,
      expectedVersion: 2,
      draft,
      actor: { ...actor, role: "viewer" },
    });
    expect(result.kind).toBe("forbidden");
  });
});
