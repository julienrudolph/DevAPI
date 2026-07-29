import {
  executeRequestSchema,
  proxyResponseSchema,
  requestAuthSchema,
  type ProxyResponse,
  type RequestAuth,
  type RequestDraft,
} from "@api-client/contracts";
import { z } from "zod";

const executionErrorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
});

export class RequestExecutionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export async function executeRequest(
  input: { request: RequestDraft; auth: RequestAuth },
  accessToken: string,
): Promise<ProxyResponse> {
  const draft = input.request;
  const auth = requestAuthSchema.parse(input.auth);
  const response = await fetch("/api/v1/execute", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      executeRequestSchema.parse({
        method: draft.method,
        url: withQueryParams(draft.url, draft.queryParams),
        headers: executionHeaders(draft.headers, auth),
        body: draft.body.type === "none" ? undefined : draft.body.content,
      }),
    ),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = executionErrorSchema.safeParse(body);
    throw new RequestExecutionError(
      error.success ? error.data.code : "EXECUTION_FAILED",
      error.success
        ? error.data.message ?? "Der Request konnte nicht ausgeführt werden."
        : "Der Request konnte nicht ausgeführt werden.",
    );
  }
  return proxyResponseSchema.parse(body);
}

function executionHeaders(
  headers: RequestDraft["headers"],
  auth: RequestAuth,
): RequestDraft["headers"] {
  const withoutAuthorization = headers.filter(
    (header) =>
      header.enabled && header.key.toLowerCase() !== "authorization",
  );
  if (auth.type === "none") return withoutAuthorization;
  const value =
    auth.type === "bearer"
      ? `Bearer ${auth.token}`
      : `Basic ${encodeBasicCredentials(auth.username, auth.password)}`;
  return [
    ...withoutAuthorization,
    {
      id: crypto.randomUUID(),
      key: "Authorization",
      value,
      enabled: true,
    },
  ];
}

function encodeBasicCredentials(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function withQueryParams(
  rawUrl: string,
  entries: RequestDraft["queryParams"],
): string {
  const url = new URL(rawUrl);
  for (const entry of entries) {
    if (entry.enabled) url.searchParams.append(entry.key, entry.value);
  }
  return url.toString();
}
