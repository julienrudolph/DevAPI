import type { CreateRequestSummary } from "@api-client/contracts";

import i18n from "../../lib/i18n";
import type { OpenApiImport, OpenApiRequestDraft } from "./openapi";

const supportedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function parsePostmanCollection(source: string): OpenApiImport {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(i18n.t("errors.invalidPostmanJson", { ns: "import" }));
  }
  if (!isRecord(value) || !Array.isArray(value.item)) {
    throw new Error(i18n.t("errors.notPostmanCollection", { ns: "import" }));
  }
  const title =
    isRecord(value.info) && typeof value.info.name === "string"
      ? value.info.name
      : "Postman Import";
  const requests: OpenApiRequestDraft[] = [];
  visitItems(value.item, [], requests);
  if (requests.length === 0) {
    throw new Error(i18n.t("errors.noSupportedRequests", { ns: "import" }));
  }
  return { title, requests };
}

function visitItems(
  items: unknown[],
  parents: string[],
  result: OpenApiRequestDraft[],
): void {
  for (const item of items) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === "string" ? item.name : "Request";
    if (Array.isArray(item.item)) {
      visitItems(item.item, [...parents, name], result);
      continue;
    }
    if (!isRecord(item.request)) continue;
    const request = item.request;
    const method =
      typeof request.method === "string" ? request.method.toUpperCase() : "GET";
    if (!supportedMethods.has(method)) continue;
    const { rawUrl, queryParams } = postmanUrl(request.url);
    if (!rawUrl) continue;
    result.push({
      importId: crypto.randomUUID(),
      path: [...parents, name].join(" / "),
      name: name.slice(0, 160),
      method: method as CreateRequestSummary["method"],
      url: queryParams.length > 0 ? rawUrl.split("?")[0]! : rawUrl,
      queryParams,
      headers: postmanHeaders(request.header),
      body: postmanBody(request.body),
      assertions: [],
    });
  }
}

function postmanUrl(value: unknown): {
  rawUrl: string;
  queryParams: CreateRequestSummary["queryParams"];
} {
  if (typeof value === "string") return { rawUrl: value, queryParams: [] };
  if (!isRecord(value)) return { rawUrl: "", queryParams: [] };
  const rawUrl = typeof value.raw === "string" ? value.raw : "";
  const queryParams = Array.isArray(value.query)
    ? value.query.filter(isRecord).slice(0, 200).map((entry) => ({
        id: crypto.randomUUID(),
        key: typeof entry.key === "string" ? entry.key : "",
        value: typeof entry.value === "string" ? entry.value : "",
        enabled: entry.disabled !== true,
      }))
    : [];
  return { rawUrl, queryParams };
}

function postmanHeaders(value: unknown): CreateRequestSummary["headers"] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).slice(0, 200).map((header) => {
    const key = typeof header.key === "string" ? header.key : "";
    return {
      id: crypto.randomUUID(),
      key,
      value:
        typeof header.value === "string" && !isSensitiveHeader(key)
          ? header.value
          : "",
      enabled: header.disabled !== true,
    };
  });
}

function postmanBody(value: unknown): CreateRequestSummary["body"] {
  if (!isRecord(value) || typeof value.mode !== "string") {
    return { type: "none" };
  }
  if (value.mode === "raw" && typeof value.raw === "string") {
    const language =
      isRecord(value.options) &&
      isRecord(value.options.raw) &&
      value.options.raw.language;
    return {
      type: language === "json" ? "json" : "text",
      content: value.raw,
    };
  }
  if (value.mode === "urlencoded" && Array.isArray(value.urlencoded)) {
    return {
      type: "form-urlencoded",
      content: formLines(value.urlencoded),
    };
  }
  if (value.mode === "formdata" && Array.isArray(value.formdata)) {
    return {
      type: "multipart",
      content: formLines(
        value.formdata.filter(
          (entry) => isRecord(entry) && entry.type !== "file",
        ),
      ),
    };
  }
  return { type: "none" };
}

function formLines(entries: unknown[]): string {
  return entries
    .filter(isRecord)
    .filter((entry) => entry.disabled !== true)
    .map((entry) => {
      const key = typeof entry.key === "string" ? entry.key : "";
      const value = typeof entry.value === "string" ? entry.value : "";
      return `${key}=${value}`;
    })
    .join("\n");
}

function isSensitiveHeader(name: string): boolean {
  return [
    "authorization",
    "cookie",
    "proxy-authorization",
    "x-api-key",
    "api-key",
  ].includes(name.trim().toLowerCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
