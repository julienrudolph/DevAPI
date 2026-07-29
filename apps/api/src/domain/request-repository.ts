import type {
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

export interface RequestRepository {
  update(command: UpdatePersistedRequestCommand): Promise<UpdateResult>;
}
