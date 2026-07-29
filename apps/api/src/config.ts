import { z } from "zod";

const apiConfigSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});

export type ApiConfig = z.infer<typeof apiConfigSchema>;

export function readApiConfig(
  source: Record<string, unknown> = process.env,
): ApiConfig {
  const result = apiConfigSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      "API-Konfiguration fehlt oder ist ungültig. Prüfe SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return result.data;
}
