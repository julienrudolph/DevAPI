import type {
  ApiRequest,
  RequestConflict,
  RequestRevision,
  RequestDraft,
  RestoreRequestRevision,
  UpdateRequest,
} from "@api-client/contracts";

export type UpdateResult =
  | { kind: "updated"; request: ApiRequest }
  | { kind: "conflict"; conflict: RequestConflict }
  | { kind: "forbidden" }
  | { kind: "not-found" };

export interface UpdatePersistedRequestCommand {
  requestId: string;
  userId: string;
  accessToken: string;
  expectedVersion: number;
  draft: RequestDraft &
    Pick<UpdateRequest, "collectionId" | "folderId">;
  changeType?: "update" | "overwrite";
}

export interface FindPersistedRequestCommand {
  requestId: string;
  accessToken: string;
}

export interface DeletePersistedRequestCommand
  extends FindPersistedRequestCommand {
  userId: string;
  expectedVersion: number;
}

export interface RequestRepository {
  find(command: FindPersistedRequestCommand): Promise<ApiRequest | null>;
  listRevisions?(
    command: FindPersistedRequestCommand,
  ): Promise<RequestRevision[] | null>;
  restore?(
    command: FindPersistedRequestCommand &
      RestoreRequestRevision & { userId: string },
  ): Promise<UpdateResult>;
  remove?(
    command: DeletePersistedRequestCommand,
  ): Promise<UpdateResult>;
  update(command: UpdatePersistedRequestCommand): Promise<UpdateResult>;
}
