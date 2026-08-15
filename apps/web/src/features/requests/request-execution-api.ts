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

import i18n from "../../lib/i18n";
import { resolveVariables } from "../environments/resolve-variables";
import { isLikelyLocalTarget } from "./local-target-detection";

export type ExecutionMode = "proxy" | "local";

const executionErrorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
});

export class RequestExecutionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export function executionErrorMessage(
  code: string,
  safeServerMessage?: string,
): string {
  if (i18n.exists(`executionErrors.${code}`, { ns: "requests" })) {
    return i18n.t(`executionErrors.${code}`, { ns: "requests" });
  }
  return (
    safeServerMessage ?? i18n.t("executionErrors.fallback", { ns: "requests" })
  );
}

export async function executeRequest(
  input: {
    requestId: string;
    request: RequestDraft;
    auth: RequestAuth;
    variables: EnvironmentVariable[];
    executionModeOverride?: ExecutionMode;
  },
  accessToken: string,
): Promise<ProxyResponse> {
  const draft = input.request;
  const auth = requestAuthSchema.parse(input.auth);
  let executionPayload: z.infer<typeof executeSavedRequestSchema>;
  try {
    const preparedBody = prepareRequestBody(draft.body, input.variables);
    executionPayload =
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
          preparedBody.contentType,
        ),
        body: preparedBody.value,
      });
  } catch (error) {
    if (error instanceof TypeError) {
      const code = "INVALID_URL";
      throw new RequestExecutionError(code, executionErrorMessage(code));
    }
    throw error;
  }

  const executeLocally = window.devapiDesktop?.executeLocalRequest;
  if (
    executeLocally &&
    input.executionModeOverride !== "proxy" &&
    (input.executionModeOverride === "local" ||
      isLikelyLocalTarget(executionPayload.url))
  ) {
    const { requestId: _requestId, ...localPayload } = executionPayload;
    const result = await executeLocally(localPayload);
    if (!result.ok) {
      throw new RequestExecutionError(
        result.code,
        executionErrorMessage(result.code, result.message),
      );
    }
    await recordLocalExecutionSafely(
      {
        requestId: input.requestId,
        method: executionPayload.method,
        statusCode: result.response.status,
        durationMs: result.response.durationMs,
        successful: result.response.status < 400,
      },
      accessToken,
    );
    return result.response;
  }

  let response: Response;
  try {
    response = await fetch("/api/v1/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(executionPayload),
    });
  } catch {
    const code = "API_UNREACHABLE";
    throw new RequestExecutionError(code, executionErrorMessage(code));
  }

  const responseText = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(responseText);
  } catch {
    const code = "INVALID_RESPONSE";
    throw new RequestExecutionError(code, executionErrorMessage(code));
  }
  if (!response.ok) {
    const error = executionErrorSchema.safeParse(body);
    const code = error.success ? error.data.code : "EXECUTION_FAILED";
    throw new RequestExecutionError(
      code,
      executionErrorMessage(code, error.success ? error.data.message : undefined),
    );
  }
  const parsed = proxyResponseSchema.safeParse(body);
  if (!parsed.success) {
    const code = "INVALID_RESPONSE";
    throw new RequestExecutionError(code, executionErrorMessage(code));
  }
  return parsed.data;
}

async function recordLocalExecutionSafely(
  record: {
    requestId: string;
    method: RequestDraft["method"];
    statusCode: number;
    durationMs: number;
    successful: boolean;
  },
  accessToken: string,
): Promise<void> {
  try {
    await fetch("/api/v1/executions/local", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
    });
  } catch {
    // The shared history is diagnostic-only metadata; a failure to record
    // it must never surface as a failed request execution to the user.
  }
}

function executionHeaders(
  headers: RequestDraft["headers"],
  auth: RequestAuth,
  defaultContentType?: string,
): RequestDraft["headers"] {
  const enabledHeaders = headers.filter(
    (header) => header.enabled && header.key.trim().length > 0,
  );
  const withDefaultContentType =
    defaultContentType &&
    !enabledHeaders.some(
      (header) => header.key.trim().toLowerCase() === "content-type",
    )
      ? [
          ...enabledHeaders,
          {
            id: crypto.randomUUID(),
            key: "Content-Type",
            value: defaultContentType,
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

export function prepareRequestBody(
  body: RequestDraft["body"],
  variables: EnvironmentVariable[],
): { value?: string; contentType?: string } {
  if (body.type === "none") return {};
  const content = resolveVariables(body.content, variables);
  if (body.type === "json") {
    return { value: content, contentType: "application/json" };
  }
  if (body.type === "text") return { value: content };

  const entries = parseFormLines(content);
  if (body.type === "form-urlencoded") {
    const encoded = new URLSearchParams();
    for (const [key, value] of entries) encoded.append(key, value);
    return {
      value: encoded.toString(),
      contentType: "application/x-www-form-urlencoded",
    };
  }

  const boundary = `----RelayFormBoundary${crypto.randomUUID().replaceAll("-", "")}`;
  const value = entries
    .map(
      ([key, entryValue]) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${entryValue}\r\n`,
    )
    .join("") + `--${boundary}--\r\n`;
  return {
    value,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function parseFormLines(content: string): [string, string][] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const separator = line.indexOf("=");
      const key = (separator < 0 ? line : line.slice(0, separator)).trim();
      const value = separator < 0 ? "" : line.slice(separator + 1);
      if (!key || /["\r\n]/.test(key)) {
        throw new Error(
          i18n.t("executionErrors.invalidFormFieldName", { ns: "requests" }),
        );
      }
      return [key, value];
    });
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
