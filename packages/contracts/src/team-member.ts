import { z } from "zod";

import { isoDateTimeSchema } from "./date-time.js";
import { invitationRoleSchema } from "./invitation.js";
import { workspaceRoleSchema } from "./role.js";

export const teamMemberParamsSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const updateTeamMemberSchema = z.object({
  role: invitationRoleSchema,
});

export const teamMemberSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: workspaceRoleSchema,
  joinedAt: isoDateTimeSchema,
});

export const teamMembersSchema = z.array(teamMemberSchema);

export type TeamMember = z.infer<typeof teamMemberSchema>;
export type UpdateTeamMember = z.infer<typeof updateTeamMemberSchema>;
