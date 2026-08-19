import { z } from "zod";

const booleanStringSchema = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  if (value.toLocaleLowerCase() === "true") return true;
  if (value.toLocaleLowerCase() === "false") return false;
  return value;
}, z.boolean());

const apiConfigSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Optional: only self-service account deletion needs this. Never sent to
  // the browser and never used for anything but auth.admin.deleteUser on
  // the caller's own, already-authenticated userId (AGENTS.md 7.3, 11.3).
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional(),
  ),
  PROXY_INTERNAL_URL: z.string().url(),
  PROXY_INTERNAL_TOKEN: z.string().min(32),
  METRICS_TOKEN: z.preprocess(
    emptyStringToUndefined,
    z.string().min(32).optional(),
  ),
  PUBLIC_SUPABASE_URL: z.string().url(),
  OIDC_PROVIDER: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .regex(/^custom:[a-z0-9][a-z0-9:-]{0,42}[a-z0-9]$/)
      .optional(),
  ),
  OIDC_LABEL: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(80).optional(),
  ),
  PASSWORD_AUTH_ENABLED: booleanStringSchema.default(true),
  PASSWORD_SIGNUP_ENABLED: booleanStringSchema.default(true),
  MAGIC_LINK_AUTH_ENABLED: booleanStringSchema.default(false),
  EXECUTION_RATE_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
  EXECUTION_RATE_PER_USER: z.coerce.number().int().min(1).default(60),
  EXECUTION_RATE_PER_WORKSPACE: z.coerce.number().int().min(1).default(300),
  EXECUTION_CONCURRENCY_PER_USER: z.coerce.number().int().min(1).default(3),
  EXECUTION_CONCURRENCY_PER_WORKSPACE: z.coerce
    .number()
    .int()
    .min(1)
    .default(10),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === ""
    ? undefined
    : value;
}

export type ApiConfig = z.infer<typeof apiConfigSchema>;

export function readApiConfig(
  source: Record<string, unknown> = process.env,
): ApiConfig {
  const result = apiConfigSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      "API-Konfiguration fehlt oder ist ungültig. Prüfe Supabase- und Proxy-Konfiguration.",
    );
  }
  return result.data;
}
