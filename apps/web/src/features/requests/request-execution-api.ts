import {
  executeSavedRequestSchema,
  proxyResponseSchema,
  requestAuthSchema,
  type ProxyResponse,
  type EnvironmentVariable,
  type RequestAuth,
  type RequestDraft,
} from "@api-client/contracts";
import { z } from "zod";

import { resolveVariables } from "../environments/resolve-variables";

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
  input: {
    requestId: string;
    request: RequestDraft;
    auth: RequestAuth;
    variables: EnvironmentVariable[];
  },
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
      executeSavedRequestSchema.parse({
        requestId: input.requestId,
        method: draft.method,
        url: withQueryParams(
          resolveVariables(draft.url, input.variables),
          draft.queryParams.map((entry) => ({
            ...entry,
            key: resolveVariables(entry.key, input.variables),
            value: resolveVariables(entry.value, input.variables),
          })),
        ),
        headers: executionHeaders(
          draft.headers.map((header) => ({
            ...header,
            key: resolveVariables(header.key, input.variables),
            value: resolveVariables(header.value, input.variables),
          })),
          auth,
          draft.body.type,
        ),
        body:
          draft.body.type === "none"
            ? undefined
            : resolveVariables(draft.body.content, input.variables),
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
  bodyType: RequestDraft["body"]["type"],
): RequestDraft["headers"] {
  const enabledHeaders = headers.filter(
    (header) => header.enabled && header.key.trim().length > 0,
  );
  const withDefaultContentType =
    bodyType === "json" &&
    !enabledHeaders.some(
      (header) => header.key.trim().toLowerCase() === "content-type",
    )
      ? [
          ...enabledHeaders,
          {
            id: crypto.randomUUID(),
            key: "Content-Type",
            value: "application/json",
            enabled: true,
          },
        ]
      : enabledHeaders;

  if (auth.type === "none") return withDefaultContentType;

  const withoutAuthorization = withDefaultContentType.filter(
    (header) =>
      header.key.trim().toLowerCase() !== "authorization",
  );
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
