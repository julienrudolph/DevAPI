import { createSupabaseAuthenticator } from "./auth/authenticator.js";
import { buildApp } from "./app.js";
import { readApiConfig } from "./config.js";
import { SupabaseRequestRepository } from "./infrastructure/supabase-request-repository.js";
import { SupabaseWorkspaceRepository } from "./infrastructure/supabase-workspace-repository.js";
import { HttpRequestExecutor } from "./infrastructure/http-request-executor.js";
import { SupabaseEnvironmentRepository } from "./infrastructure/supabase-environment-repository.js";

const config = readApiConfig();
const app = buildApp({
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
  environments: new SupabaseEnvironmentRepository(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  ),
});

await app.listen({ host: "127.0.0.1", port: config.API_PORT });
