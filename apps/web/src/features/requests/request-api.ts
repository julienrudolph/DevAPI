import {
  apiRequestSchema,
  requestConflictSchema,
  updateRequestSchema,
  type ApiRequest,
  type RequestConflict,
  type UpdateRequest,
} from "@api-client/contracts";

export class RequestConflictError extends Error {
  constructor(readonly conflict: RequestConflict) {
    super("REQUEST_VERSION_CONFLICT");
  }
}

export async function fetchRequest(
  requestId: string,
  accessToken: string,
): Promise<ApiRequest> {
  const response = await fetch(`/api/v1/requests/${requestId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`REQUEST_READ_${response.status}`);
  return apiRequestSchema.parse(await response.json());
}

export async function updateRequest(
  requestId: string,
  input: UpdateRequest,
  accessToken: string,
): Promise<ApiRequest> {
  const response = await fetch(`/api/v1/requests/${requestId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateRequestSchema.parse(input)),
  });
  if (response.status === 409) {
    throw new RequestConflictError(
      requestConflictSchema.parse(await response.json()),
    );
  }
  if (!response.ok) throw new Error(`REQUEST_UPDATE_${response.status}`);
  return apiRequestSchema.parse(await response.json());
}
