import {
  type ApiRequest,
  type RequestDraft,
  type RequestConflict,
  type WorkspaceRole,
  canEdit,
} from "@api-client/contracts";

export interface RequestRevision {
  id: string;
  requestId: string;
  version: number;
  snapshot: ApiRequest;
  createdBy: string;
  createdAt: string;
  changeType: "update" | "overwrite";
}

export type UpdateResult =
  | { kind: "updated"; request: ApiRequest }
  | { kind: "conflict"; conflict: RequestConflict }
  | { kind: "forbidden" }
  | { kind: "not-found" };

export interface UpdateRequestCommand {
  requestId: string;
  expectedVersion: number;
  draft: RequestDraft;
  actor: { id: string; displayName: string; role: WorkspaceRole };
  changeType?: "update" | "overwrite";
}

export class InMemoryRequestStore {
  readonly revisions: RequestRevision[] = [];
  readonly requests = new Map<string, ApiRequest>();

  constructor(initialRequests: ApiRequest[] = []) {
    initialRequests.forEach((request) => this.requests.set(request.id, request));
  }

  update(command: UpdateRequestCommand): UpdateResult {
    if (!canEdit(command.actor.role)) return { kind: "forbidden" };
    const current = this.requests.get(command.requestId);
    if (!current) return { kind: "not-found" };

    if (current.version !== command.expectedVersion) {
      return {
        kind: "conflict",
        conflict: {
          code: "REQUEST_VERSION_CONFLICT",
          message: "Der Request wurde zwischenzeitlich geändert.",
          expectedVersion: command.expectedVersion,
          currentVersion: current.version,
          current,
          updatedBy: {
            id: current.updatedBy,
            displayName: "Teammitglied",
          },
          updatedAt: current.updatedAt,
        },
      };
    }

    const now = new Date().toISOString();
    this.revisions.push({
      id: crypto.randomUUID(),
      requestId: current.id,
      version: current.version,
      snapshot: structuredClone(current),
      createdBy: command.actor.id,
      createdAt: now,
      changeType: command.changeType ?? "update",
    });

    const updated: ApiRequest = {
      ...current,
      ...structuredClone(command.draft),
      version: current.version + 1,
      updatedBy: command.actor.id,
      updatedAt: now,
    };
    this.requests.set(updated.id, updated);
    return { kind: "updated", request: updated };
  }
}
