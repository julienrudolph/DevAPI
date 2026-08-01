import type { RequestDraft } from "@api-client/contracts";

export type CurlRequestDraft = Pick<
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

export function parseCurl(command: string): CurlRequestDraft {
  const tokens = tokenize(command.trim());
  if (tokens.shift()?.toLowerCase() !== "curl") {
    throw new Error("Der Import muss mit curl beginnen.");
  }

  let explicitMethod: RequestDraft["method"] | undefined;
  let url = "";
  let bodyContent: string | undefined;
  const headers: RequestDraft["headers"] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const nextValue = () => {
      const value = tokens[index + 1];
      if (value === undefined) {
        throw new Error(`Für ${token} fehlt ein Wert.`);
      }
      index += 1;
      return value;
    };

    if (token === "-X" || token === "--request") {
      explicitMethod = parseMethod(nextValue());
    } else if (token.startsWith("--request=")) {
      explicitMethod = parseMethod(token.slice("--request=".length));
    } else if (token === "-H" || token === "--header") {
      headers.push(parseHeader(nextValue()));
    } else if (token.startsWith("--header=")) {
      headers.push(parseHeader(token.slice("--header=".length)));
    } else if (
      token === "-d" ||
      token === "--data" ||
      token === "--data-raw" ||
      token === "--data-binary"
    ) {
      bodyContent = nextValue();
    } else if (
      token.startsWith("--data=") ||
      token.startsWith("--data-raw=") ||
      token.startsWith("--data-binary=")
    ) {
      bodyContent = token.slice(token.indexOf("=") + 1);
    } else if (token === "--url") {
      url = nextValue();
    } else if (token.startsWith("--url=")) {
      url = token.slice("--url=".length);
    } else if (
      token === "-L" ||
      token === "--location" ||
      token === "--compressed" ||
      token === "-s" ||
      token === "--silent"
    ) {
      continue;
    } else if (token.startsWith("-")) {
      throw new Error(`Die cURL-Option ${token} wird noch nicht unterstützt.`);
    } else if (!url) {
      url = token;
    } else {
      throw new Error(`Unerwarteter Wert im cURL-Kommando: ${token}`);
    }
  }

  if (!url) throw new Error("Das cURL-Kommando enthält keine URL.");
  try {
    new URL(url);
  } catch {
    throw new Error("Die cURL-URL ist ungültig.");
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

export function formatCurl(draft: RequestDraft): string {
  const url = new URL(draft.url);
  for (const entry of draft.queryParams) {
    if (entry.enabled && entry.key) {
      url.searchParams.append(entry.key, entry.value);
    }
  }

  const parts = ["curl", "-X", draft.method, shellQuote(url.toString())];
  for (const header of draft.headers) {
    if (header.enabled && header.key.trim()) {
      parts.push("-H", shellQuote(`${header.key.trim()}: ${header.value}`));
    }
  }
  if (draft.body.type !== "none") {
    parts.push("--data-raw", shellQuote(draft.body.content));
  }
  return parts.join(" ");
}

function parseMethod(rawMethod: string): RequestDraft["method"] {
  const method = rawMethod.toUpperCase() as RequestDraft["method"];
  if (!methods.has(method)) {
    throw new Error(`Die HTTP-Methode ${rawMethod} wird nicht unterstützt.`);
  }
  return method;
}

function parseHeader(rawHeader: string): RequestDraft["headers"][number] {
  const separator = rawHeader.indexOf(":");
  if (separator <= 0) {
    throw new Error(`Der Header "${rawHeader}" ist ungültig.`);
  }
  return {
    id: crypto.randomUUID(),
    key: rawHeader.slice(0, separator).trim(),
    value: rawHeader.slice(separator + 1).trimStart(),
    enabled: true,
  };
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

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | '"' | undefined;
  let escaping = false;

  for (const character of command) {
    if (escaping) {
      token += character;
      escaping = false;
    } else if (character === "\\" && quote !== "'") {
      escaping = true;
    } else if (quote) {
      if (character === quote) quote = undefined;
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) {
        tokens.push(token);
        token = "";
      }
    } else {
      token += character;
    }
  }
  if (quote) throw new Error("Das cURL-Kommando enthält ein offenes Anführungszeichen.");
  if (escaping) token += "\\";
  if (token) tokens.push(token);
  return tokens;
}
