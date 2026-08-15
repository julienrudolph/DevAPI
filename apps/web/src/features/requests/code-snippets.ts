import type { RequestDraft } from "@api-client/contracts";

import { formatCurl } from "./curl";
import { formatPowerShell } from "./powershell";

export type SnippetLanguage = "curl" | "powershell" | "fetch" | "python";

export const snippetLanguages: { id: SnippetLanguage; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "powershell", label: "PowerShell" },
  { id: "fetch", label: "JavaScript (fetch)" },
  { id: "python", label: "Python (requests)" },
];

export function formatCodeSnippet(
  draft: RequestDraft,
  language: SnippetLanguage,
): string {
  switch (language) {
    case "curl":
      return formatCurl(draft);
    case "powershell":
      return formatPowerShell(draft);
    case "fetch":
      return formatFetch(draft);
    case "python":
      return formatPythonRequests(draft);
  }
}

function buildUrl(draft: RequestDraft): string {
  const url = new URL(draft.url);
  for (const entry of draft.queryParams) {
    if (entry.enabled && entry.key) {
      url.searchParams.append(entry.key, entry.value);
    }
  }
  return url.toString();
}

function enabledHeaders(
  draft: RequestDraft,
): { key: string; value: string }[] {
  return draft.headers
    .filter((header) => header.enabled && header.key.trim())
    .map((header) => ({ key: header.key.trim(), value: header.value }));
}

function formatFetch(draft: RequestDraft): string {
  const url = buildUrl(draft);
  const headers = enabledHeaders(draft);
  const lines = [`fetch(${JSON.stringify(url)}, {`];
  lines.push(`  method: ${JSON.stringify(draft.method)},`);
  if (headers.length > 0) {
    lines.push(`  headers: {`);
    for (const header of headers) {
      lines.push(
        `    ${JSON.stringify(header.key)}: ${JSON.stringify(header.value)},`,
      );
    }
    lines.push(`  },`);
  }
  if (draft.body.type !== "none") {
    lines.push(`  body: ${JSON.stringify(draft.body.content)},`);
  }
  lines.push(`});`);
  return lines.join("\n");
}

function formatPythonRequests(draft: RequestDraft): string {
  const url = buildUrl(draft);
  const headers = enabledHeaders(draft);
  const lines = ["import requests", ""];

  if (headers.length > 0) {
    lines.push("headers = {");
    for (const header of headers) {
      lines.push(
        `    ${JSON.stringify(header.key)}: ${JSON.stringify(header.value)},`,
      );
    }
    lines.push("}", "");
  }
  if (draft.body.type !== "none") {
    lines.push(`data = ${JSON.stringify(draft.body.content)}`, "");
  }

  const args = [JSON.stringify(url)];
  if (headers.length > 0) args.push("headers=headers");
  if (draft.body.type !== "none") args.push("data=data");
  lines.push(
    `response = requests.${draft.method.toLowerCase()}(${args.join(", ")})`,
  );
  return lines.join("\n");
}
