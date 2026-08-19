import type { SoleOwnerTeam } from "@api-client/contracts";

import type { AuthenticatedRepositoryCommand } from "./workspace-repository.js";

export interface AccountRepository {
  // Teams where the caller is the only owner - self-deletion is blocked
  // while any exist (AGENTS.md 7.3 decision), so the caller must transfer
  // ownership or delete the team first.
  listBlockingTeams(
    command: AuthenticatedRepositoryCommand,
  ): Promise<SoleOwnerTeam[]>;
  // Deletes the authenticated user's own auth.users row via the Supabase
  // Admin API (service role); every FK referencing it is either
  // ON DELETE CASCADE (memberships, personal secrets) or ON DELETE SET NULL
  // (created_by/updated_by/executed_by, anonymizing shared content).
  deleteAccount(userId: string): Promise<void>;
}
