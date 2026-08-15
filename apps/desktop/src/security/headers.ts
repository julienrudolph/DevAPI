// Duplicated from apps/proxy/src/security/headers.ts rather than imported:
// apps/desktop and apps/proxy are separate deployable apps, and internal
// implementations are not shared across app boundaries (AGENTS.md 5.2).
const forbiddenRequestHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const sensitiveHeaders = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
]);

const validHeaderName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export class UnsafeHeaderError extends Error {
  constructor(message = "Ein Header ist nicht erlaubt.") {
    super(message);
    this.name = "UnsafeHeaderError";
  }
}

export function sanitizeRequestHeaders(
  entries: readonly {
    key: string;
    value: string;
    enabled: boolean;
  }[],
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const entry of entries) {
    if (!entry.enabled) continue;
    const name = entry.key.trim().toLowerCase();
    if (!validHeaderName.test(name) || forbiddenRequestHeaders.has(name)) {
      throw new UnsafeHeaderError();
    }
    if (/[\r\n\0]/.test(entry.value)) {
      throw new UnsafeHeaderError();
    }
    headers[name] = entry.value;
  }
  return headers;
}

export function sanitizeResponseHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.toLowerCase();
    if (sensitiveHeaders.has(name) || rawValue === undefined) continue;
    safe[name] = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
  }
  return safe;
}
