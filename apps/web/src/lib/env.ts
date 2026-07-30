import { z } from "zod";

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_OIDC_PROVIDER: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .regex(/^custom:[a-z0-9][a-z0-9:-]{0,42}[a-z0-9]$/)
      .optional(),
  ),
  VITE_OIDC_LABEL: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(80).optional(),
  ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function readPublicEnv(
  source: Record<string, unknown> = import.meta.env,
): PublicEnv | null {
  const result = publicEnvSchema.safeParse(source);
  return result.success ? result.data : null;
}

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === ""
    ? undefined
    : value;
}
