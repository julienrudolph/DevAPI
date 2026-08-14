import type { CreateRequestSummary } from "@api-client/contracts";
import { parseDocument } from "yaml";

import i18n from "../../lib/i18n";

const supportedMethods = ["get", "post", "put", "patch", "delete"] as const;
type HttpMethod = CreateRequestSummary["method"];

export interface OpenApiRequestDraft
  extends Omit<CreateRequestSummary, "collectionId" | "folderId"> {
  importId: string;
  path: string;
}

export interface OpenApiImport {
  title: string;
  requests: OpenApiRequestDraft[];
}

export function parseOpenApi(source: string): OpenApiImport {
  const document = parseDocument(source, {
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(i18n.t("errors.invalidJsonOrYaml", { ns: "import" }));
  }
  const value: unknown = document.toJS({ maxAliasCount: 50 });
  if (!isRecord(value) || typeof value.openapi !== "string") {
    throw new Error(i18n.t("errors.notOpenApiDocument", { ns: "import" }));
  }
  if (!value.openapi.startsWith("3.")) {
    throw new Error(i18n.t("errors.unsupportedVersion", { ns: "import" }));
  }
  if (!isRecord(value.paths)) {
    throw new Error(i18n.t("errors.noValidPaths", { ns: "import" }));
  }

  const title =
    isRecord(value.info) && typeof value.info.title === "string"
      ? value.info.title
      : "OpenAPI Import";
  const serverUrl = firstServerUrl(value.servers);
  const requests: OpenApiRequestDraft[] = [];

  for (const [path, pathItem] of Object.entries(value.paths)) {
    if (!isRecord(pathItem)) continue;
    for (const method of supportedMethods) {
      const operation = pathItem[method];
      if (!isRecord(operation)) continue;
      const request = operationToRequest(
        method.toUpperCase() as HttpMethod,
        path,
        serverUrl,
        [...asParameters(pathItem.parameters), ...asParameters(operation.parameters)],
        operation,
      );
      requests.push(request);
    }
  }
  if (requests.length === 0) {
    throw new Error(
      i18n.t("errors.noSupportedOperations", { ns: "import" }),
    );
  }
  return { title, requests };
}

function operationToRequest(
  method: HttpMethod,
  path: string,
  serverUrl: string,
  parameters: Record<string, unknown>[],
  operation: Record<string, unknown>,
): OpenApiRequestDraft {
  const queryParams = parameters
    .filter((parameter) => parameter.in === "query")
    .map((parameter) => ({
      id: crypto.randomUUID(),
      key: typeof parameter.name === "string" ? parameter.name : "parameter",
      value: parameterExample(parameter),
      enabled: parameter.required === true,
    }));
  const headers = parameters
    .filter((parameter) => parameter.in === "header")
    .map((parameter) => ({
      id: crypto.randomUUID(),
      key: typeof parameter.name === "string" ? parameter.name : "Header",
      value: parameterExample(parameter),
      enabled: parameter.required === true,
    }));
  const body = requestBody(operation.requestBody);
  if (
    body.type === "json" &&
    !headers.some(({ key }) => key.toLocaleLowerCase() === "content-type")
  ) {
    headers.push({
      id: crypto.randomUUID(),
      key: "Content-Type",
      value: "application/json",
      enabled: true,
    });
  }
  const name =
    stringValue(operation.summary) ??
    stringValue(operation.operationId) ??
    `${method} ${path}`;
  return {
    importId: `${method}:${path}`,
    path,
    name: name.slice(0, 160),
    method,
    url: joinUrl(serverUrl, path),
    queryParams,
    headers,
    body,
    assertions: [],
  };
}

function requestBody(value: unknown): CreateRequestSummary["body"] {
  if (!isRecord(value) || !isRecord(value.content)) return { type: "none" };
  const json = value.content["application/json"];
  if (!isRecord(json)) return { type: "none" };
  const example =
    json.example ?? (isRecord(json.schema) ? exampleFromSchema(json.schema) : {});
  return {
    type: "json",
    content: JSON.stringify(example ?? {}, null, 2),
  };
}

function exampleFromSchema(schema: Record<string, unknown>): unknown {
  if ("example" in schema) return schema.example;
  if ("default" in schema) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === "array") {
    return isRecord(schema.items) ? [exampleFromSchema(schema.items)] : [];
  }
  if (schema.type === "object" || isRecord(schema.properties)) {
    return Object.fromEntries(
      Object.entries(isRecord(schema.properties) ? schema.properties : {})
        .filter((entry): entry is [string, Record<string, unknown>] =>
          isRecord(entry[1]),
        )
        .map(([key, property]) => [key, exampleFromSchema(property)]),
    );
  }
  if (schema.type === "boolean") return false;
  if (schema.type === "integer" || schema.type === "number") return 0;
  return "";
}

function parameterExample(parameter: Record<string, unknown>): string {
  const value =
    parameter.example ??
    (isRecord(parameter.schema)
      ? parameter.schema.example ??
        parameter.schema.default ??
        (Array.isArray(parameter.schema.enum) ? parameter.schema.enum[0] : "")
      : "");
  return value === undefined || value === null ? "" : String(value);
}

function asParameters(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function firstServerUrl(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const first = value.find(
    (server): server is Record<string, unknown> =>
      isRecord(server) && typeof server.url === "string",
  );
  return first ? String(first.url) : "";
}

function joinUrl(serverUrl: string, path: string): string {
  if (!serverUrl) return path;
  return `${serverUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
