import { z } from "zod";

export const environmentIdParamsSchema = z.object({
  environmentId: z.string().uuid(),
});

export const environmentVariableIdParamsSchema = z.object({
  variableId: z.string().uuid(),
});

export const createEnvironmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
});

export const updateEnvironmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  expectedVersion: z.number().int().positive(),
});

export const deleteEnvironmentSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const deleteEnvironmentVariableSchema = z.object({
  expectedVersion: z.number().int().positive(),
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

export const updateEnvironmentVariableSchema = z
  .object({
    key: variableKeySchema.optional(),
    value: z.string().max(32_768).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .refine((value) => value.key !== undefined || value.value !== undefined, {
    message: "Schlüssel oder Wert ist erforderlich.",
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

export const environmentVariableConflictSchema = z.object({
  code: z.literal("ENVIRONMENT_VARIABLE_VERSION_CONFLICT"),
  message: z.string(),
  expectedVersion: z.number().int().positive(),
  currentVersion: z.number().int().positive(),
  current: environmentVariableSchema,
});

export const environmentConflictSchema = z.object({
  code: z.literal("ENVIRONMENT_VERSION_CONFLICT"),
  message: z.string(),
  expectedVersion: z.number().int().positive(),
  currentVersion: z.number().int().positive(),
  current: environmentSchema,
});

export type CreateEnvironment = z.infer<typeof createEnvironmentSchema>;
export type UpdateEnvironment = z.infer<typeof updateEnvironmentSchema>;
export type DeleteEnvironment = z.infer<typeof deleteEnvironmentSchema>;
export type DeleteEnvironmentVariable = z.infer<
  typeof deleteEnvironmentVariableSchema
>;
export type Environment = z.infer<typeof environmentSchema>;
export type EnvironmentVariable = z.infer<
  typeof environmentVariableSchema
>;
export type EnvironmentConflict = z.infer<typeof environmentConflictSchema>;
export type EnvironmentVariableConflict = z.infer<
  typeof environmentVariableConflictSchema
>;
export type UpsertEnvironmentVariable = z.infer<
  typeof upsertEnvironmentVariableSchema
>;
export type UpdateEnvironmentVariable = z.infer<
  typeof updateEnvironmentVariableSchema
>;
