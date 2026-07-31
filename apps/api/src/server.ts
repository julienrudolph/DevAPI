import { createSupabaseAuthenticator } from "./auth/authenticator.js";
import { buildApp } from "./app.js";
import { readApiConfig } from "./config.js";
import { SupabaseRequestRepository } from "./infrastructure/supabase-request-repository.js";
import { SupabaseWorkspaceRepository } from "./infrastructure/supabase-workspace-repository.js";
import { HttpRequestExecutor } from "./infrastructure/http-request-executor.js";
import { SupabaseEnvironmentRepository } from "./infrastructure/supabase-environment-repository.js";
import { SupabaseExecutionHistoryRepository } from "./infrastructure/supabase-execution-history-repository.js";
import { SupabaseInvitationRepository } from "./infrastructure/supabase-invitation-repository.js";
import { SupabaseTeamMemberRepository } from "./infrastructure/supabase-team-member-repository.js";
import { InMemoryExecutionLimiter } from "./domain/execution-limiter.js";

const config = readApiConfig();

async function dependencyAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

const app = buildApp({
  logger: true,
  metricsToken: config.METRICS_TOKEN ?? config.PROXY_INTERNAL_TOKEN,
  readiness: async () => ({
    supabase: await dependencyAvailable(
      new URL("/health", config.SUPABASE_URL).toString(),
    ),
    proxy: await dependencyAvailable(
      new URL("/health", config.PROXY_INTERNAL_URL).toString(),
    ),
  }),
  publicConfig: {
    apiBaseUrl: "/api",
    supabaseUrl: config.PUBLIC_SUPABASE_URL,
    supabasePublishableKey: config.SUPABASE_PUBLISHABLE_KEY,
    passwordAuthEnabled: config.PASSWORD_AUTH_ENABLED,
    passwordSignupEnabled: config.PASSWORD_SIGNUP_ENABLED,
    magicLinkAuthEnabled: config.MAGIC_LINK_AUTH_ENABLED,
    oidcProvider: config.OIDC_PROVIDER,
    oidcLabel: config.OIDC_LABEL,
  },
  authenticate: createSupabaseAuthenticator(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  ),
  requests: new SupabaseRequestRepository(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  ),
  workspaces: new SupabaseWorkspaceRepository(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  ),
  executor: new HttpRequestExecutor(
    config.PROXY_INTERNAL_URL,
    config.PROXY_INTERNAL_TOKEN,
  ),
  executionLimiter: new InMemoryExecutionLimiter({
    windowMs: config.EXECUTION_RATE_WINDOW_MS,
    maxPerUserPerWindow: config.EXECUTION_RATE_PER_USER,
    maxPerWorkspacePerWindow: config.EXECUTION_RATE_PER_WORKSPACE,
    maxConcurrentPerUser: config.EXECUTION_CONCURRENCY_PER_USER,
    maxConcurrentPerWorkspace: config.EXECUTION_CONCURRENCY_PER_WORKSPACE,
  }),
  environments: new SupabaseEnvironmentRepository(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  ),
  executionHistory: new SupabaseExecutionHistoryRepository(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  ),
  invitations: new SupabaseInvitationRepository(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  ),
  teamMembers: new SupabaseTeamMemberRepository(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  ),
});

await app.listen({ host: config.API_HOST, port: config.API_PORT });
