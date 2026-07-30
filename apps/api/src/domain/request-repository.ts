import type {
  ApiRequest,
  RequestRevision,
  RequestDraft,
  RestoreRequestRevision,
  UpdateRequest,
} from "@api-client/contracts";

import type { UpdateResult } from "./request-store.js";

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

export interface RequestRepository {
  find(command: FindPersistedRequestCommand): Promise<ApiRequest | null>;
  listRevisions?(
    command: FindPersistedRequestCommand,
  ): Promise<RequestRevision[] | null>;
  restore?(
    command: FindPersistedRequestCommand &
      RestoreRequestRevision & { userId: string },
  ): Promise<UpdateResult>;
  update(command: UpdatePersistedRequestCommand): Promise<UpdateResult>;
}
