import { soleOwnerTeamsSchema, type SoleOwnerTeam } from "@api-client/contracts";
import { createClient } from "@supabase/supabase-js";

import type { AccountRepository } from "../domain/account-repository.js";
import type { AuthenticatedRepositoryCommand } from "../domain/workspace-repository.js";
import { createUserSupabaseClient } from "./supabase-user-client.js";

export class SupabaseAccountRepository implements AccountRepository {
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
    private readonly serviceRoleKey: string,
  ) {}

  async listBlockingTeams(
    command: AuthenticatedRepositoryCommand,
  ): Promise<SoleOwnerTeam[]> {
    const client = createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      command.accessToken,
    );
    const { data, error } = await client.rpc("list_sole_owner_teams");
    if (error) {
      throw new Error("ACCOUNT_BLOCKING_TEAMS_LOOKUP_FAILED", {
        cause: error,
      });
    }
    return soleOwnerTeamsSchema.parse(data);
  }

  async deleteAccount(userId: string): Promise<void> {
    // Deliberately not RLS-scoped: deleting an auth.users row requires the
    // Admin API and the service role key. The caller's identity is already
    // established by the route (self-service only, never a target userId
    // taken from the request body) before this is ever invoked.
    const admin = createClient(this.supabaseUrl, this.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error("ACCOUNT_DELETE_FAILED", { cause: error });
    }
  }
}
