import { z } from "zod";

export const teamIdParamsSchema = z.object({
  teamId: z.string().uuid(),
});

export const invitationRoleSchema = z.enum(["editor", "viewer"]);

export const createTeamInvitationSchema = z.object({
  role: invitationRoleSchema,
});

export const acceptTeamInvitationSchema = z.object({
  token: z.string().min(43).max(256),
});

export const teamInvitationSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  role: invitationRoleSchema,
  token: z.string().min(43),
  expiresAt: z.string().datetime(),
});

export const acceptedTeamInvitationSchema = z.object({
  teamId: z.string().uuid(),
});

export type AcceptTeamInvitation = z.infer<
  typeof acceptTeamInvitationSchema
>;
export type CreateTeamInvitation = z.infer<
  typeof createTeamInvitationSchema
>;
export type TeamInvitation = z.infer<typeof teamInvitationSchema>;
