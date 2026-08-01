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

const executionErrorMessages: Record<string, string> = {
  INVALID_URL:
    "Die URL ist ungültig. Prüfe insbesondere Protokoll, Domain und Sonderzeichen.",
  UNSAFE_TARGET:
    "Das Ziel wurde aus Sicherheitsgründen blockiert. Lokale, private und reservierte Netzwerkadressen sind über den Server-Proxy nicht erlaubt.",
  UNSAFE_HEADER:
    "Mindestens ein Header ist nicht zulässig. Prüfe Headernamen und entferne Zeilenumbrüche aus den Werten.",
  TARGET_DNS_FAILED:
    "Der Hostname konnte nicht aufgelöst werden. Prüfe die Schreibweise der Domain und die DNS-Konfiguration des Servers.",
  TARGET_CONNECTION_REFUSED:
    "Der Zielserver hat die Verbindung abgelehnt. Prüfe Host, Port und ob der Zieldienst läuft.",
  TARGET_UNREACHABLE:
    "Der Zielserver ist aus dem DevAPI-Servernetz nicht erreichbar. Prüfe URL, Port, Firewall und DNS.",
  TARGET_TLS_FAILED:
    "Die TLS-Verbindung ist fehlgeschlagen. Prüfe Zertifikat, Hostnamen und Zertifikatskette des Zielservers.",
  TARGET_TIMEOUT:
    "Der Zielserver hat nicht rechtzeitig geantwortet. Prüfe seine Erreichbarkeit oder versuche es später erneut.",
  REDIRECT_LIMIT_EXCEEDED:
    "Der Zielserver hat zu oft weitergeleitet. Prüfe die URL und mögliche Redirect-Schleifen.",
  RESPONSE_TOO_LARGE:
    "Die Antwort überschreitet das Sicherheitslimit des Proxys und wurde abgebrochen.",
  TARGET_REQUEST_FAILED:
    "Der Zielserver konnte nicht erreicht werden. Prüfe URL, DNS, Port und Erreichbarkeit vom DevAPI-Server.",
  PROXY_REQUEST_FAILED:
    "Der interne Request-Proxy hat keine gültige Antwort geliefert. Prüfe den Proxy-Container und dessen Logs.",
  PROXY_UNAVAILABLE:
    "Der Request-Proxy ist momentan nicht verfügbar. Prüfe den Serverstatus und versuche es erneut.",
  EXECUTION_RATE_LIMITED:
    "Du hast in kurzer Zeit zu viele Requests gesendet. Warte kurz und versuche es erneut.",
  EXECUTION_CONCURRENCY_LIMITED:
    "Es laufen bereits zu viele Requests. Warte auf deren Abschluss und versuche es erneut.",
  PROXY_CAPACITY_LIMITED:
    "Der Request-Proxy ist momentan ausgelastet. Warte kurz und versuche es erneut.",
  AUTHENTICATION_UNAVAILABLE:
    "Die Anmeldung konnte serverseitig nicht geprüft werden. Melde dich gegebenenfalls erneut an.",
  UNAUTHORIZED: "Deine Sitzung ist abgelaufen. Melde dich erneut an.",
  REQUEST_NOT_FOUND:
    "Der gespeicherte Request ist nicht mehr verfügbar oder du hast keinen Zugriff darauf.",
  API_UNREACHABLE:
    "Das DevAPI-Backend ist nicht erreichbar. Prüfe Netzwerkverbindung und Serverstatus.",
  INVALID_RESPONSE:
    "Das DevAPI-Backend hat eine unerwartete Antwort geliefert. Prüfe die Server- und Proxy-Logs.",
};

export function executionErrorMessage(
  code: string,
  safeServerMessage?: string,
): string {
  return executionErrorMessages[code] ?? safeServerMessage ??
    "Der Request konnte nicht ausgeführt werden. Prüfe Eingaben und Serverstatus.";
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
        throw new Error("Formularfeldname ist ungültig.");
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
