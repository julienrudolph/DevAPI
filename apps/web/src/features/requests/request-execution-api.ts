import {
  executeRequestSchema,
  proxyResponseSchema,
  type ProxyResponse,
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
  draft: RequestDraft,
  accessToken: string,
): Promise<ProxyResponse> {
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
        headers: draft.headers.filter((header) => header.enabled),
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
