import type { EnvironmentVariable } from "@api-client/contracts";

const placeholderPattern = /\{\{([A-Za-z_][A-Za-z0-9_.-]*)\}\}/g;

export class UnresolvedVariableError extends Error {
  constructor(readonly keys: string[]) {
    super(`Nicht aufgelöste Variablen: ${keys.join(", ")}`);
  }
}

export function resolveVariables(
  value: string,
  variables: EnvironmentVariable[],
): string {
  const values = new Map<string, string>();
  for (const variable of variables.filter(({ scope }) => scope === "shared")) {
    values.set(variable.key, variable.value);
  }
  for (const variable of variables.filter(({ scope }) => scope === "personal")) {
    values.set(variable.key, variable.value);
  }
  const missing = new Set<string>();
  const resolved = value.replace(placeholderPattern, (_match, key: string) => {
    const replacement = values.get(key);
    if (replacement === undefined) {
      missing.add(key);
      return `{{${key}}}`;
    }
    return replacement;
  });
  if (missing.size > 0) {
    throw new UnresolvedVariableError([...missing].sort());
  }
  return resolved;
}
