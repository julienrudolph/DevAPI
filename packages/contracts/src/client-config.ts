import { z } from "zod";

export const publicClientConfigSchema = z.object({
  apiBaseUrl: z.string().trim().min(1).default("/api"),
  supabaseUrl: z.string().url(),
  supabasePublishableKey: z.string().min(1),
  passwordAuthEnabled: z.boolean().default(true),
  passwordSignupEnabled: z.boolean().default(true),
  magicLinkAuthEnabled: z.boolean().default(false),
  oidcProvider: z
    .string()
    .regex(/^custom:[a-z0-9][a-z0-9:-]{0,42}[a-z0-9]$/)
    .optional(),
  oidcLabel: z.string().trim().min(1).max(80).optional(),
});

export type PublicClientConfig = z.infer<typeof publicClientConfigSchema>;
