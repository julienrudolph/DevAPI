import {
  apiRequestSchema,
  requestConflictSchema,
  requestRevisionsSchema,
  restoreRequestRevisionSchema,
  type ApiRequest,
  type RequestRevision,
  type RestoreRequestRevision,
} from "@api-client/contracts";

import { RequestConflictError } from "../requests/request-api";

export async function fetchRequestRevisions(
  requestId: string,
  accessToken: string,
): Promise<RequestRevision[]> {
  const response = await fetch(`/api/v1/requests/${requestId}/revisions`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`REVISION_LIST_${response.status}`);
  return requestRevisionsSchema.parse(await response.json());
}

export async function restoreRequestRevision(
  requestId: string,
  input: RestoreRequestRevision,
  accessToken: string,
): Promise<ApiRequest> {
  const response = await fetch(`/api/v1/requests/${requestId}/restore`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(restoreRequestRevisionSchema.parse(input)),
  });
  if (response.status === 409) {
    throw new RequestConflictError(
      requestConflictSchema.parse(await response.json()),
    );
  }
  if (!response.ok) throw new Error(`REVISION_RESTORE_${response.status}`);
  return apiRequestSchema.parse(await response.json());
}
