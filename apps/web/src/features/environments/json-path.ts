export type JsonPathResult =
  | { found: true; value: unknown }
  | { found: false };

/**
 * Resolves a small subset of JSONPath: dot-separated keys with optional
 * array indices, either as `items.0.id` or `items[0].id`.
 */
export function resolveJsonPath(value: unknown, path: string): JsonPathResult {
  const normalized = path.trim().replace(/\[(\d+)\]/g, ".$1");
  if (!normalized) return { found: false };

  let current: unknown = value;
  for (const segment of normalized.split(".").filter(Boolean)) {
    if (current === null || current === undefined) return { found: false };
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false };
      }
      current = current[index];
    } else if (typeof current === "object") {
      if (!Object.hasOwn(current, segment)) return { found: false };
      current = (current as Record<string, unknown>)[segment];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: current };
}

export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function stringifyExtractedValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value);
}
