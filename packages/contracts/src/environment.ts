import { z } from "zod";

export const environmentIdParamsSchema = z.object({
  environmentId: z.string().uuid(),
});

export const createEnvironmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
});

export const variableKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(
    /^[A-Za-z_][A-Za-z0-9_.-]*$/,
    "Variablennamen dürfen nur Buchstaben, Zahlen, Punkt, Bindestrich und Unterstrich enthalten.",
  );

export const variableScopeSchema = z.enum(["shared", "personal"]);

export const upsertEnvironmentVariableSchema = z.object({
  key: variableKeySchema,
  value: z.string().max(32_768),
  scope: variableScopeSchema,
});

export const environmentVariableSchema = z.object({
  id: z.string().uuid(),
  environmentId: z.string().uuid(),
  key: variableKeySchema,
  value: z.string(),
  scope: variableScopeSchema,
  version: z.number().int().positive(),
});

export const environmentSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(160),
  version: z.number().int().positive(),
  variables: z.array(environmentVariableSchema),
});

export type CreateEnvironment = z.infer<typeof createEnvironmentSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type EnvironmentVariable = z.infer<
  typeof environmentVariableSchema
>;
export type UpsertEnvironmentVariable = z.infer<
  typeof upsertEnvironmentVariableSchema
>;
