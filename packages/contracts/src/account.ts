import { z } from "zod";

// Self-service account deletion (AGENTS.md 7.3): the caller confirms by
// retyping their own email, checked server-side against their
// authenticated session - not just a client-side confirmation dialog.
export const deleteAccountSchema = z.object({
  confirmEmail: z.string().email(),
});

export const soleOwnerTeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

export const soleOwnerTeamsSchema = z.array(soleOwnerTeamSchema);

export type DeleteAccount = z.infer<typeof deleteAccountSchema>;
export type SoleOwnerTeam = z.infer<typeof soleOwnerTeamSchema>;
