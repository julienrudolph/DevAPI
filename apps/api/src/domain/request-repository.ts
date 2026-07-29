import type {
  ApiRequest,
  RequestDraft,
} from "@api-client/contracts";

import type { UpdateResult } from "./request-store.js";

export interface UpdatePersistedRequestCommand {
  requestId: string;
  userId: string;
  accessToken: string;
  expectedVersion: number;
  draft: RequestDraft;
  changeType?: "update" | "overwrite";
}

export interface FindPersistedRequestCommand {
  requestId: string;
  accessToken: string;
}

export interface RequestRepository {
  find(command: FindPersistedRequestCommand): Promise<ApiRequest | null>;
  update(command: UpdatePersistedRequestCommand): Promise<UpdateResult>;
}
