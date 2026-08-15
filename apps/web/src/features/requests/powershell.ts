import type { RequestDraft } from "@api-client/contracts";

import i18n from "../../lib/i18n";

function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, { ns: "requests", ...options });
}

export type PowerShellRequestDraft = Pick<
  RequestDraft,
  "method" | "url" | "queryParams" | "headers" | "body"
>;

const methods = new Set<RequestDraft["method"]>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

const invokeCommands = new Set([
  "invoke-restmethod",
  "invoke-webrequest",
  "irm",
  "iwr",
]);

export function parsePowerShell(command: string): PowerShellRequestDraft {
  // PowerShell allows a command to span multiple lines using a trailing
  // backtick; join those before tokenizing so a copy-pasted multi-line
  // command parses the same as its single-line form.
  const normalized = command.trim().replace(/`\r?\n\s*/g, " ");
  const tokens = tokenize(normalized);
  const commandName = tokens.shift()?.toLowerCase();
  if (!commandName || !invokeCommands.has(commandName)) {
    throw new Error(t("powershell.mustStartWithInvoke"));
  }

  let explicitMethod: RequestDraft["method"] | undefined;
  let url = "";
  let bodyContent: string | undefined;
  let contentType: string | undefined;
  const headers: RequestDraft["headers"] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const nextValue = () => {
      const value = tokens[index + 1];
      if (value === undefined) {
        throw new Error(t("powershell.missingValueFor", { token }));
      }
      index += 1;
      return value;
    };
    const flag = token.toLowerCase();

    if (flag === "-uri" || flag === "-url") {
      url = nextValue();
    } else if (flag === "-method") {
      explicitMethod = parseMethod(nextValue());
    } else if (flag === "-headers") {
      headers.push(...parseHeadersHashtable(nextValue()));
    } else if (flag === "-body") {
      bodyContent = nextValue();
    } else if (flag === "-contenttype") {
      contentType = nextValue();
    } else if (flag === "-useragent") {
      nextValue();
    } else if (
      flag === "-usebasicparsing" ||
      flag === "-skipcertificatecheck" ||
      flag === "-allowunencryptedauthentication"
    ) {
      continue;
    } else if (token.startsWith("-")) {
      throw new Error(t("powershell.unsupportedOption", { token }));
    } else if (!url) {
      url = token;
    } else {
      throw new Error(t("powershell.unexpectedValue", { token }));
    }
  }

  if (!url) throw new Error(t("powershell.missingUrl"));
  try {
    new URL(url);
  } catch {
    throw new Error(t("powershell.invalidUrl"));
  }

  if (contentType) {
    headers.push({
      id: crypto.randomUUID(),
      key: "Content-Type",
      value: contentType,
      enabled: true,
    });
  }

  const method = explicitMethod ?? (bodyContent === undefined ? "GET" : "POST");
  return {
    method,
    url,
    queryParams: [],
    headers,
    body:
      bodyContent === undefined
        ? { type: "none" }
        : {
            type: isJsonBody(bodyContent, headers) ? "json" : "text",
            content: bodyContent,
          },
  };
}

export function formatPowerShell(draft: RequestDraft): string {
  const url = new URL(draft.url);
  for (const entry of draft.queryParams) {
    if (entry.enabled && entry.key) {
      url.searchParams.append(entry.key, entry.value);
    }
  }
  const headers = draft.headers.filter(
    (header) => header.enabled && header.key.trim(),
  );
  const bodyArg =
    draft.body.type === "none" ? "" : ` -Body ${psQuote(draft.body.content)}`;
  const headersArg =
    headers.length === 0
      ? ""
      : ` -Headers @{ ${headers
          .map(
            (header) =>
              `${psQuote(header.key.trim())} = ${psQuote(header.value)}`,
          )
          .join("; ")} }`;

  return `Invoke-RestMethod -Uri ${psQuote(url.toString())} -Method ${draft.method}${headersArg}${bodyArg}`;
}

function parseMethod(rawMethod: string): RequestDraft["method"] {
  const method = rawMethod.toUpperCase() as RequestDraft["method"];
  if (!methods.has(method)) {
    throw new Error(t("powershell.unsupportedMethod", { method: rawMethod }));
  }
  return method;
}

function parseHeadersHashtable(raw: string): RequestDraft["headers"] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("@{") || !trimmed.endsWith("}")) {
    throw new Error(t("powershell.invalidHeadersHashtable"));
  }
  const inner = trimmed.slice(2, -1);
  const headers: RequestDraft["headers"] = [];
  for (const entry of splitHashtableEntries(inner)) {
    const equalsIndex = findTopLevelEquals(entry);
    if (equalsIndex < 0) {
      throw new Error(t("powershell.invalidHeader", { header: entry }));
    }
    headers.push({
      id: crypto.randomUUID(),
      key: stripQuotes(entry.slice(0, equalsIndex)),
      value: stripQuotes(entry.slice(equalsIndex + 1)),
      enabled: true,
    });
  }
  return headers;
}

function splitHashtableEntries(text: string): string[] {
  const entries: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  for (const character of text) {
    if (quote) {
      current += character;
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (character === ";" || character === "\n") {
      if (current.trim()) entries.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) entries.push(current.trim());
  return entries;
}

function findTopLevelEquals(entry: string): number {
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < entry.length; index += 1) {
    const character = entry[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "=") return index;
  }
  return -1;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isJsonBody(
  body: string,
  headers: RequestDraft["headers"],
): boolean {
  const contentType = headers.find(
    (header) => header.key.toLowerCase() === "content-type",
  )?.value;
  if (contentType?.toLowerCase().includes("json")) return true;
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < command.length) {
    const character = command[index]!;
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "@" && command[index + 1] === "{") {
      const start = index;
      index += 2; // skip past the opening "@{"
      let depth = 1;
      let quote: "'" | '"' | undefined;
      while (depth > 0 && index < command.length) {
        const current = command[index];
        if (quote) {
          if (current === quote) quote = undefined;
        } else if (current === "'" || current === '"') {
          quote = current;
        } else if (current === "{") {
          depth += 1;
        } else if (current === "}") {
          depth -= 1;
        }
        index += 1;
      }
      tokens.push(command.slice(start, index));
      continue;
    }
    if (character === "'" || character === '"') {
      const quote = character;
      let value = "";
      index += 1;
      while (index < command.length && command[index] !== quote) {
        if (quote === '"' && command[index] === "`") {
          index += 1;
          value += command[index] ?? "";
          index += 1;
          continue;
        }
        value += command[index];
        index += 1;
      }
      if (index >= command.length) throw new Error(t("powershell.unclosedQuote"));
      index += 1;
      tokens.push(value);
      continue;
    }
    const start = index;
    while (index < command.length && !/\s/.test(command[index]!)) index += 1;
    tokens.push(command.slice(start, index));
  }
  return tokens;
}
