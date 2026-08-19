import {
  acceptTeamInvitationSchema,
  createCollectionSchema,
  createEnvironmentSchema,
  createFolderSchema,
  createRequestSummarySchema,
  createTeamInvitationSchema,
  createWorkspaceSchema,
  collectionIdParamsSchema,
  deleteEnvironmentSchema,
  deleteEnvironmentVariableSchema,
  deleteNavigationItemSchema,
  deleteRequestSchema,
  executeRequestSchema,
  executeSavedRequestSchema,
  recordLocalExecutionSchema,
  environmentIdParamsSchema,
  environmentVariableIdParamsSchema,
  folderIdParamsSchema,
  updateFolderNavigationSchema,
  requestIdParamsSchema,
  restoreRequestRevisionSchema,
  teamIdParamsSchema,
  invitationIdParamsSchema,
  teamMemberParamsSchema,
  transferTeamOwnershipSchema,
  updateEnvironmentSchema,
  updateEnvironmentVariableSchema,
  updateNavigationItemSchema,
  updateRequestSchema,
  updateTeamMemberSchema,
  upsertEnvironmentVariableSchema,
  workspaceIdParamsSchema,
  type PublicClientConfig,
} from "@api-client/contracts";
import Fastify, { type FastifyBaseLogger, type FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";

import type {
  AuthenticatedUser,
  Authenticator,
} from "./auth/authenticator.js";
import type { EnvironmentRepository } from "./domain/environment-repository.js";
import type {
  ExecutionHistoryRepository,
  RecordExecutionCommand,
} from "./domain/execution-history-repository.js";
import {
  InMemoryExecutionLimiter,
  type ExecutionLimiter,
} from "./domain/execution-limiter.js";
import {
  idempotencyKeyFromHeader,
  InMemoryIdempotencyStore,
  type IdempotencyStore,
} from "./domain/idempotency-store.js";
import type { InvitationRepository } from "./domain/invitation-repository.js";
import type { TeamMemberRepository } from "./domain/team-member-repository.js";
import {
  RequestExecutionError,
  type RequestExecutor,
} from "./domain/request-executor.js";
import type { RequestRepository } from "./domain/request-repository.js";
import type {
  DeleteNavigationItemResult,
  UpdateCollectionResult,
  UpdateFolderResult,
  WorkspaceRepository,
} from "./domain/workspace-repository.js";
import { HttpOperations, validBearerToken } from "./operations.js";

export interface ApiDependencies {
  authenticate: Authenticator;
  requests: RequestRepository;
  workspaces: WorkspaceRepository;
  executor?: RequestExecutor;
  environments?: EnvironmentRepository;
  invitations?: InvitationRepository;
  teamMembers?: TeamMemberRepository;
  executionHistory?: ExecutionHistoryRepository;
  executionLimiter?: ExecutionLimiter;
  idempotency?: IdempotencyStore;
  publicConfig?: PublicClientConfig;
  metricsToken?: string;
  readiness?: () => Promise<Record<string, boolean>>;
  logger?: boolean;
}

export function buildApp(dependencies: ApiDependencies) {
  const app = Fastify({
    logger: dependencies.logger ?? false,
    genReqId: () => randomUUID(),
  });
  app.addHook("onRequest", async (request, reply) => {
    void reply.header("X-Request-ID", request.id);
  });
  const operations = new HttpOperations();
  operations.attach(app);
  const executionLimiter =
    dependencies.executionLimiter ??
    new InMemoryExecutionLimiter({
      windowMs: 60_000,
      maxPerUserPerWindow: 60,
      maxPerWorkspacePerWindow: 300,
      maxConcurrentPerUser: 3,
      maxConcurrentPerWorkspace: 10,
    });
  const idempotency =
    dependencies.idempotency ??
    new InMemoryIdempotencyStore({ ttlMs: 2 * 60_000 });

  app.get(
    "/health",
    { logLevel: "silent" },
    async () => ({ status: "ok" }),
  );
  app.get("/ready", { logLevel: "error" }, async (request, reply) => {
    try {
      const checks = dependencies.readiness
        ? await dependencies.readiness()
        : { application: true };
      const ready = Object.values(checks).every(Boolean);
      return reply.code(ready ? 200 : 503).send({
        status: ready ? "ready" : "unavailable",
        checks,
      });
    } catch (error) {
      request.log.error({ err: error }, "READINESS_CHECK_FAILED");
      return reply
        .code(503)
        .send({ status: "unavailable", checks: { dependencies: false } });
    }
  });
  app.get("/metrics", { logLevel: "silent" }, async (request, reply) => {
    if (
      !validBearerToken(
        request.headers.authorization,
        dependencies.metricsToken,
      )
    ) {
      return reply.code(401).send({ code: "UNAUTHORIZED" });
    }
    return reply
      .type("text/plain; version=0.0.4; charset=utf-8")
      .send(operations.render("devapi_api"));
  });

  app.get("/v1/config", async (_request, reply) => {
    if (!dependencies.publicConfig) {
      return reply.code(503).send({ code: "CLIENT_CONFIG_UNAVAILABLE" });
    }
    return reply
      .header("Cache-Control", "no-store")
      .send(dependencies.publicConfig);
  });

  app.post("/v1/teams/:teamId/invitations", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = teamIdParamsSchema.safeParse(request.params);
    const body = createTeamInvitationSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.invitations) {
      return reply.code(503).send({ code: "INVITATIONS_UNAVAILABLE" });
    }
    const idempotencyKey = idempotencyKeyFromHeader(
      request.headers["idempotency-key"],
    );
    const idempotencyCacheKey = idempotencyKey
      ? `${user.user.id}:invitations:${idempotencyKey}`
      : undefined;
    if (idempotencyCacheKey) {
      const cached = idempotency.get(idempotencyCacheKey);
      if (cached) return reply.code(cached.status).send(cached.body);
    }
    try {
      const invitation = await dependencies.invitations.create({
        teamId: params.data.teamId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
        ...body.data,
      });
      if (!invitation) return reply.code(403).send({ code: "FORBIDDEN" });
      if (idempotencyCacheKey) {
        idempotency.set(idempotencyCacheKey, {
          status: 201,
          body: invitation,
        });
      }
      return reply.code(201).send(invitation);
    } catch (error) {
      request.log.error({ err: error }, "INVITATION_CREATE_FAILED");
      return reply.code(500).send({ code: "INVITATION_CREATE_FAILED" });
    }
  });

  app.get("/v1/teams/:teamId/invitations", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = teamIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.invitations) {
      return reply.code(503).send({ code: "INVITATIONS_UNAVAILABLE" });
    }
    try {
      const invitations = await dependencies.invitations.list({
        teamId: params.data.teamId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return invitations
        ? reply.code(200).send(invitations)
        : reply.code(403).send({ code: "FORBIDDEN" });
    } catch (error) {
      request.log.error({ err: error }, "INVITATIONS_LIST_FAILED");
      return reply.code(500).send({ code: "INVITATIONS_LIST_FAILED" });
    }
  });

  app.post(
    "/v1/teams/:teamId/invitations/:invitationId/revoke",
    async (request, reply) => {
      const user = await authenticateSafely(
        dependencies.authenticate,
        request.headers.authorization,
        request.log,
      );
      if (user.kind !== "authenticated") {
        return reply
          .code(user.kind === "unavailable" ? 503 : 401)
          .send({
            code:
              user.kind === "unavailable"
                ? "AUTHENTICATION_UNAVAILABLE"
                : "UNAUTHORIZED",
          });
      }
      const params = invitationIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ code: "INVALID_REQUEST" });
      }
      if (!dependencies.invitations) {
        return reply.code(503).send({ code: "INVITATIONS_UNAVAILABLE" });
      }
      try {
        const revoked = await dependencies.invitations.revoke({
          invitationId: params.data.invitationId,
          userId: user.user.id,
          accessToken: user.user.accessToken,
        });
        if (revoked === null) {
          return reply.code(403).send({ code: "FORBIDDEN" });
        }
        return revoked
          ? reply.code(204).send()
          : reply.code(404).send({ code: "INVITATION_NOT_FOUND" });
      } catch (error) {
        request.log.error({ err: error }, "INVITATION_REVOKE_FAILED");
        return reply.code(500).send({ code: "INVITATION_REVOKE_FAILED" });
      }
    },
  );

  app.post("/v1/invitations/accept", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const body = acceptTeamInvitationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.invitations) {
      return reply.code(503).send({ code: "INVITATIONS_UNAVAILABLE" });
    }
    try {
      const teamId = await dependencies.invitations.accept({
        token: body.data.token,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return teamId
        ? reply.code(200).send({ teamId })
        : reply.code(404).send({ code: "INVITATION_NOT_FOUND" });
    } catch (error) {
      request.log.error({ err: error }, "INVITATION_ACCEPT_FAILED");
      return reply.code(500).send({ code: "INVITATION_ACCEPT_FAILED" });
    }
  });

  app.get("/v1/teams/:teamId/members", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply.code(user.kind === "unavailable" ? 503 : 401).send({
        code:
          user.kind === "unavailable"
            ? "AUTHENTICATION_UNAVAILABLE"
            : "UNAUTHORIZED",
      });
    }
    const params = teamIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.teamMembers) {
      return reply.code(503).send({ code: "TEAM_MEMBERS_UNAVAILABLE" });
    }
    try {
      const members = await dependencies.teamMembers.list({
        teamId: params.data.teamId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return members
        ? reply.code(200).send(members)
        : reply.code(403).send({ code: "FORBIDDEN" });
    } catch (error) {
      request.log.error({ err: error }, "TEAM_MEMBERS_LIST_FAILED");
      return reply.code(500).send({ code: "TEAM_MEMBERS_LIST_FAILED" });
    }
  });

  app.patch("/v1/teams/:teamId/members/:userId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply.code(user.kind === "unavailable" ? 503 : 401).send({
        code:
          user.kind === "unavailable"
            ? "AUTHENTICATION_UNAVAILABLE"
            : "UNAUTHORIZED",
      });
    }
    const params = teamMemberParamsSchema.safeParse(request.params);
    const body = updateTeamMemberSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.teamMembers) {
      return reply.code(503).send({ code: "TEAM_MEMBERS_UNAVAILABLE" });
    }
    try {
      const updated = await dependencies.teamMembers.update({
        teamId: params.data.teamId,
        targetUserId: params.data.userId,
        role: body.data.role,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      if (updated === null) return reply.code(403).send({ code: "FORBIDDEN" });
      return updated
        ? reply.code(204).send()
        : reply.code(404).send({ code: "TEAM_MEMBER_NOT_FOUND" });
    } catch (error) {
      request.log.error({ err: error }, "TEAM_MEMBER_UPDATE_FAILED");
      return reply.code(500).send({ code: "TEAM_MEMBER_UPDATE_FAILED" });
    }
  });

  app.delete("/v1/teams/:teamId/members/:userId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply.code(user.kind === "unavailable" ? 503 : 401).send({
        code:
          user.kind === "unavailable"
            ? "AUTHENTICATION_UNAVAILABLE"
            : "UNAUTHORIZED",
      });
    }
    const params = teamMemberParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.teamMembers) {
      return reply.code(503).send({ code: "TEAM_MEMBERS_UNAVAILABLE" });
    }
    try {
      const removed = await dependencies.teamMembers.remove({
        teamId: params.data.teamId,
        targetUserId: params.data.userId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      if (removed === null) return reply.code(403).send({ code: "FORBIDDEN" });
      return removed
        ? reply.code(204).send()
        : reply.code(404).send({ code: "TEAM_MEMBER_NOT_FOUND" });
    } catch (error) {
      request.log.error({ err: error }, "TEAM_MEMBER_REMOVE_FAILED");
      return reply.code(500).send({ code: "TEAM_MEMBER_REMOVE_FAILED" });
    }
  });

  app.post("/v1/teams/:teamId/ownership-transfer", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply.code(user.kind === "unavailable" ? 503 : 401).send({
        code:
          user.kind === "unavailable"
            ? "AUTHENTICATION_UNAVAILABLE"
            : "UNAUTHORIZED",
      });
    }
    const params = teamIdParamsSchema.safeParse(request.params);
    const body = transferTeamOwnershipSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.teamMembers) {
      return reply.code(503).send({ code: "TEAM_MEMBERS_UNAVAILABLE" });
    }
    try {
      const transferred = await dependencies.teamMembers.transferOwnership({
        teamId: params.data.teamId,
        newOwnerUserId: body.data.newOwnerUserId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      if (transferred === null) {
        return reply.code(403).send({ code: "FORBIDDEN" });
      }
      return transferred
        ? reply.code(204).send()
        : reply.code(404).send({ code: "TEAM_MEMBER_NOT_FOUND" });
    } catch (error) {
      request.log.error({ err: error }, "TEAM_OWNERSHIP_TRANSFER_FAILED");
      return reply.code(500).send({ code: "TEAM_OWNERSHIP_TRANSFER_FAILED" });
    }
  });

  app.get("/v1/workspaces/:workspaceId/environments", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = workspaceIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.environments) {
      return reply.code(503).send({ code: "ENVIRONMENTS_UNAVAILABLE" });
    }
    try {
      return reply.code(200).send(
        await dependencies.environments.list({
          workspaceId: params.data.workspaceId,
          userId: user.user.id,
          accessToken: user.user.accessToken,
        }),
      );
    } catch (error) {
      request.log.error({ err: error }, "ENVIRONMENT_LIST_FAILED");
      return reply.code(500).send({ code: "ENVIRONMENT_LIST_FAILED" });
    }
  });

  app.post("/v1/workspaces/:workspaceId/environments", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = workspaceIdParamsSchema.safeParse(request.params);
    const body = createEnvironmentSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.environments) {
      return reply.code(503).send({ code: "ENVIRONMENTS_UNAVAILABLE" });
    }
    try {
      const environment = await dependencies.environments.create({
        workspaceId: params.data.workspaceId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
        ...body.data,
      });
      return environment
        ? reply.code(201).send(environment)
        : reply.code(403).send({ code: "FORBIDDEN" });
    } catch (error) {
      request.log.error({ err: error }, "ENVIRONMENT_CREATE_FAILED");
      return reply.code(500).send({ code: "ENVIRONMENT_CREATE_FAILED" });
    }
  });

  app.post(
    "/v1/environments/:environmentId/variables",
    async (request, reply) => {
      const user = await authenticateSafely(
        dependencies.authenticate,
        request.headers.authorization,
        request.log,
      );
      if (user.kind !== "authenticated") {
        return reply
          .code(user.kind === "unavailable" ? 503 : 401)
          .send({
            code:
              user.kind === "unavailable"
                ? "AUTHENTICATION_UNAVAILABLE"
                : "UNAUTHORIZED",
          });
      }
      const params = environmentIdParamsSchema.safeParse(request.params);
      const body = upsertEnvironmentVariableSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ code: "INVALID_REQUEST" });
      }
      if (!dependencies.environments) {
        return reply.code(503).send({ code: "ENVIRONMENTS_UNAVAILABLE" });
      }
      try {
        const result = await dependencies.environments.createVariable({
          environmentId: params.data.environmentId,
          userId: user.user.id,
          accessToken: user.user.accessToken,
          ...body.data,
        });
        if (result.kind === "forbidden") {
          return reply.code(403).send({ code: "FORBIDDEN" });
        }
        if (result.kind === "duplicate") {
          return reply.code(409).send({ code: "VARIABLE_ALREADY_EXISTS" });
        }
        return reply.code(201).send(result.variable);
      } catch (error) {
        request.log.error({ err: error }, "ENVIRONMENT_VARIABLE_CREATE_FAILED");
        return reply
          .code(500)
          .send({ code: "ENVIRONMENT_VARIABLE_CREATE_FAILED" });
      }
    },
  );

  app.patch(
    "/v1/environment-variables/:variableId",
    async (request, reply) => {
      const user = await authenticateSafely(
        dependencies.authenticate,
        request.headers.authorization,
        request.log,
      );
      if (user.kind !== "authenticated") {
        return reply
          .code(user.kind === "unavailable" ? 503 : 401)
          .send({
            code:
              user.kind === "unavailable"
                ? "AUTHENTICATION_UNAVAILABLE"
                : "UNAUTHORIZED",
          });
      }
      const params = environmentVariableIdParamsSchema.safeParse(
        request.params,
      );
      const body = updateEnvironmentVariableSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ code: "INVALID_REQUEST" });
      }
      if (!dependencies.environments) {
        return reply.code(503).send({ code: "ENVIRONMENTS_UNAVAILABLE" });
      }
      try {
        const result = await dependencies.environments.updateVariable({
          variableId: params.data.variableId,
          userId: user.user.id,
          accessToken: user.user.accessToken,
          ...body.data,
        });
        if (result.kind === "forbidden") {
          return reply.code(403).send({ code: "FORBIDDEN" });
        }
        if (result.kind === "not-found") {
          return reply.code(404).send({ code: "NOT_FOUND" });
        }
        if (result.kind === "conflict") {
          return reply.code(409).send({
            code: "ENVIRONMENT_VARIABLE_VERSION_CONFLICT",
            message: "Die Variable wurde zwischenzeitlich geändert.",
            expectedVersion: body.data.expectedVersion,
            currentVersion: result.current.version,
            current: result.current,
          });
        }
        if (result.kind === "duplicate") {
          return reply.code(409).send({ code: "VARIABLE_ALREADY_EXISTS" });
        }
        return reply.code(200).send(result.variable);
      } catch (error) {
        request.log.error({ err: error }, "ENVIRONMENT_VARIABLE_UPDATE_FAILED");
        return reply
          .code(500)
          .send({ code: "ENVIRONMENT_VARIABLE_UPDATE_FAILED" });
      }
    },
  );

  app.delete(
    "/v1/environment-variables/:variableId",
    async (request, reply) => {
      const user = await authenticateSafely(
        dependencies.authenticate,
        request.headers.authorization,
        request.log,
      );
      if (user.kind !== "authenticated") {
        return reply
          .code(user.kind === "unavailable" ? 503 : 401)
          .send({
            code:
              user.kind === "unavailable"
                ? "AUTHENTICATION_UNAVAILABLE"
                : "UNAUTHORIZED",
          });
      }
      const params = environmentVariableIdParamsSchema.safeParse(
        request.params,
      );
      const body = deleteEnvironmentVariableSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ code: "INVALID_REQUEST" });
      }
      if (!dependencies.environments) {
        return reply.code(503).send({ code: "ENVIRONMENTS_UNAVAILABLE" });
      }
      try {
        const result = await dependencies.environments.removeVariable({
          variableId: params.data.variableId,
          userId: user.user.id,
          accessToken: user.user.accessToken,
          ...body.data,
        });
        if (result.kind === "forbidden") {
          return reply.code(403).send({ code: "FORBIDDEN" });
        }
        if (result.kind === "not-found") {
          return reply.code(404).send({ code: "NOT_FOUND" });
        }
        if (result.kind === "conflict") {
          return reply.code(409).send({
            code: "ENVIRONMENT_VARIABLE_VERSION_CONFLICT",
            message: "Die Variable wurde zwischenzeitlich geändert.",
            expectedVersion: body.data.expectedVersion,
            currentVersion: result.current.version,
            current: result.current,
          });
        }
        return reply.code(204).send();
      } catch (error) {
        request.log.error({ err: error }, "ENVIRONMENT_VARIABLE_DELETE_FAILED");
        return reply
          .code(500)
          .send({ code: "ENVIRONMENT_VARIABLE_DELETE_FAILED" });
      }
    },
  );

  app.patch("/v1/environments/:environmentId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply.code(user.kind === "unavailable" ? 503 : 401).send({
        code:
          user.kind === "unavailable"
            ? "AUTHENTICATION_UNAVAILABLE"
            : "UNAUTHORIZED",
      });
    }
    const params = environmentIdParamsSchema.safeParse(request.params);
    const body = updateEnvironmentSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.environments) {
      return reply.code(503).send({ code: "ENVIRONMENTS_UNAVAILABLE" });
    }
    try {
      const result = await dependencies.environments.update({
        environmentId: params.data.environmentId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
        ...body.data,
      });
      if (result.kind === "forbidden") {
        return reply.code(403).send({ code: "FORBIDDEN" });
      }
      if (result.kind === "not-found") {
        return reply.code(404).send({ code: "NOT_FOUND" });
      }
      if (result.kind === "duplicate") {
        return reply.code(409).send({ code: "ENVIRONMENT_ALREADY_EXISTS" });
      }
      if (result.kind === "conflict") {
        return reply.code(409).send({
          code: "ENVIRONMENT_VERSION_CONFLICT",
          message: "Die Umgebung wurde zwischenzeitlich geändert.",
          expectedVersion: body.data.expectedVersion,
          currentVersion: result.current.version,
          current: result.current,
        });
      }
      return reply.code(200).send(result.environment);
    } catch (error) {
      request.log.error({ err: error }, "ENVIRONMENT_UPDATE_FAILED");
      return reply.code(500).send({ code: "ENVIRONMENT_UPDATE_FAILED" });
    }
  });

  app.delete("/v1/environments/:environmentId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply.code(user.kind === "unavailable" ? 503 : 401).send({
        code:
          user.kind === "unavailable"
            ? "AUTHENTICATION_UNAVAILABLE"
            : "UNAUTHORIZED",
      });
    }
    const params = environmentIdParamsSchema.safeParse(request.params);
    const body = deleteEnvironmentSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.environments) {
      return reply.code(503).send({ code: "ENVIRONMENTS_UNAVAILABLE" });
    }
    try {
      const result = await dependencies.environments.remove({
        environmentId: params.data.environmentId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
        ...body.data,
      });
      if (result.kind === "forbidden") {
        return reply.code(403).send({ code: "FORBIDDEN" });
      }
      if (result.kind === "not-found") {
        return reply.code(404).send({ code: "NOT_FOUND" });
      }
      if (result.kind === "conflict") {
        return reply.code(409).send({
          code: "ENVIRONMENT_VERSION_CONFLICT",
          message: "Die Umgebung wurde zwischenzeitlich geändert.",
          expectedVersion: body.data.expectedVersion,
          currentVersion: result.current.version,
          current: result.current,
        });
      }
      return reply.code(204).send();
    } catch (error) {
      request.log.error({ err: error }, "ENVIRONMENT_DELETE_FAILED");
      return reply.code(500).send({ code: "ENVIRONMENT_DELETE_FAILED" });
    }
  });

  app.post("/v1/execute", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const input = executeSavedRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.executor) {
      return reply.code(503).send({ code: "PROXY_UNAVAILABLE" });
    }
    const visibleRequest = await dependencies.requests.find({
      requestId: input.data.requestId,
      accessToken: user.user.accessToken,
    });
    if (!visibleRequest) {
      return reply.code(404).send({ code: "REQUEST_NOT_FOUND" });
    }
    const idempotencyKey = idempotencyKeyFromHeader(
      request.headers["idempotency-key"],
    );
    const idempotencyCacheKey = idempotencyKey
      ? `${user.user.id}:execute:${idempotencyKey}`
      : undefined;
    if (idempotencyCacheKey) {
      const cached = idempotency.get(idempotencyCacheKey);
      if (cached) return reply.code(cached.status).send(cached.body);
    }
    const limit = executionLimiter.acquire({
      userId: user.user.id,
      workspaceId: visibleRequest.workspaceId,
    });
    if (limit.kind === "rejected") {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(limit.retryAfterMs / 1_000),
      );
      return reply
        .header("Retry-After", retryAfterSeconds)
        .code(429)
        .send({
          code:
            limit.reason === "rate"
              ? "EXECUTION_RATE_LIMITED"
              : "EXECUTION_CONCURRENCY_LIMITED",
          message:
            limit.reason === "rate"
              ? "Zu viele Requests in kurzer Zeit. Warte kurz und versuche es erneut."
              : "Es laufen bereits zu viele Requests. Warte auf deren Abschluss.",
          retryAfterSeconds,
        });
    }
    const { requestId, ...executionInput } = input.data;
    const startedAt = Date.now();
    try {
      const result = await dependencies.executor.execute(
        executeRequestSchema.parse(executionInput),
        { correlationId: request.id },
      );
      await recordExecutionSafely(dependencies.executionHistory, {
        requestId,
        method: executionInput.method,
        statusCode: result.status,
        durationMs: result.durationMs,
        successful: result.status < 400,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      }, request.log);
      if (idempotencyCacheKey) {
        idempotency.set(idempotencyCacheKey, { status: 200, body: result });
      }
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof RequestExecutionError) {
        await recordExecutionSafely(dependencies.executionHistory, {
          requestId,
          method: executionInput.method,
          statusCode: error.status,
          durationMs: Date.now() - startedAt,
          successful: false,
          userId: user.user.id,
          accessToken: user.user.accessToken,
        }, request.log);
        return reply.code(error.status).send({
          code: error.code,
          message: error.message,
        });
      }
      request.log.error({ err: error }, "PROXY_REQUEST_FAILED");
      await recordExecutionSafely(dependencies.executionHistory, {
        requestId,
        method: executionInput.method,
        statusCode: 502,
        durationMs: Date.now() - startedAt,
        successful: false,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      }, request.log);
      return reply.code(502).send({
        code: "PROXY_REQUEST_FAILED",
        message: "Der Request konnte nicht sicher ausgeführt werden.",
      });
    } finally {
      limit.release();
    }
  });

  // Requests executed locally by the desktop client (AGENTS.md 11.1a) never
  // reach the proxy, so this route only records the same shared-history
  // metadata a proxied execution would produce - never the URL, headers, or
  // body of the locally executed request.
  app.post("/v1/executions/local", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const input = recordLocalExecutionSchema.safeParse(request.body);
    if (!input.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    const visibleRequest = await dependencies.requests.find({
      requestId: input.data.requestId,
      accessToken: user.user.accessToken,
    });
    if (!visibleRequest) {
      return reply.code(404).send({ code: "REQUEST_NOT_FOUND" });
    }
    await recordExecutionSafely(dependencies.executionHistory, {
      ...input.data,
      userId: user.user.id,
      accessToken: user.user.accessToken,
    }, request.log);
    return reply.code(204).send();
  });

  app.get(
    "/v1/workspaces/:workspaceId/executions",
    async (request, reply) => {
      const user = await authenticateSafely(
        dependencies.authenticate,
        request.headers.authorization,
        request.log,
      );
      if (user.kind !== "authenticated") {
        return reply.code(user.kind === "unavailable" ? 503 : 401).send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
      }
      const params = workspaceIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ code: "INVALID_REQUEST" });
      }
      if (!dependencies.executionHistory) {
        return reply.code(503).send({ code: "EXECUTION_HISTORY_UNAVAILABLE" });
      }
      try {
        const executions = await dependencies.executionHistory.list({
          workspaceId: params.data.workspaceId,
          userId: user.user.id,
          accessToken: user.user.accessToken,
        });
        return executions
          ? reply.code(200).send(executions)
          : reply.code(404).send({ code: "WORKSPACE_NOT_FOUND" });
      } catch (error) {
        request.log.error({ err: error }, "EXECUTION_HISTORY_LIST_FAILED");
        return reply.code(500).send({ code: "EXECUTION_HISTORY_LIST_FAILED" });
      }
    },
  );

  app.get("/v1/workspaces", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind === "unavailable") {
      return reply.code(503).send({ code: "AUTHENTICATION_UNAVAILABLE" });
    }
    if (user.kind === "unauthorized") {
      return reply.code(401).send({ code: "UNAUTHORIZED" });
    }
    try {
      const workspaces = await dependencies.workspaces.list({
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return reply.code(200).send(workspaces);
    } catch (error) {
      request.log.error({ err: error }, "WORKSPACE_LIST_FAILED");
      return reply.code(500).send({ code: "WORKSPACE_LIST_FAILED" });
    }
  });

  app.post("/v1/workspaces", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({ code: user.kind === "unavailable" ? "AUTHENTICATION_UNAVAILABLE" : "UNAUTHORIZED" });
    }
    const body = createWorkspaceSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    try {
      const workspace = await dependencies.workspaces.create({
        ...body.data,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return workspace
        ? reply.code(201).send(workspace)
        : reply.code(403).send({ code: "FORBIDDEN" });
    } catch (error) {
      request.log.error({ err: error }, "WORKSPACE_CREATE_FAILED");
      return reply.code(500).send({ code: "WORKSPACE_CREATE_FAILED" });
    }
  });

  app.post("/v1/workspaces/:workspaceId/collections", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({ code: user.kind === "unavailable" ? "AUTHENTICATION_UNAVAILABLE" : "UNAUTHORIZED" });
    }
    const params = workspaceIdParamsSchema.safeParse(request.params);
    const body = createCollectionSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    try {
      const collection = await dependencies.workspaces.createCollection({
        ...body.data,
        workspaceId: params.data.workspaceId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return collection
        ? reply.code(201).send(collection)
        : reply.code(403).send({ code: "FORBIDDEN" });
    } catch (error) {
      request.log.error({ err: error }, "COLLECTION_CREATE_FAILED");
      return reply.code(500).send({ code: "COLLECTION_CREATE_FAILED" });
    }
  });

  app.post("/v1/workspaces/:workspaceId/folders", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = workspaceIdParamsSchema.safeParse(request.params);
    const body = createFolderSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    try {
      const folder = await dependencies.workspaces.createFolder({
        ...body.data,
        workspaceId: params.data.workspaceId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return folder
        ? reply.code(201).send(folder)
        : reply.code(403).send({ code: "FORBIDDEN" });
    } catch (error) {
      request.log.error({ err: error }, "FOLDER_CREATE_FAILED");
      return reply.code(500).send({ code: "FOLDER_CREATE_FAILED" });
    }
  });

  app.delete("/v1/collections/:collectionId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = collectionIdParamsSchema.safeParse(request.params);
    const body = deleteNavigationItemSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.workspaces.deleteCollection) {
      return reply.code(503).send({ code: "COLLECTION_DELETE_UNAVAILABLE" });
    }
    try {
      const result = await dependencies.workspaces.deleteCollection({
        itemId: params.data.collectionId,
        expectedVersion: body.data.expectedVersion,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return sendNavigationDeleteResult(reply, result, "COLLECTION");
    } catch (error) {
      request.log.error({ err: error }, "COLLECTION_DELETE_FAILED");
      return reply.code(500).send({ code: "COLLECTION_DELETE_FAILED" });
    }
  });

  app.delete("/v1/folders/:folderId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = folderIdParamsSchema.safeParse(request.params);
    const body = deleteNavigationItemSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.workspaces.deleteFolder) {
      return reply.code(503).send({ code: "FOLDER_DELETE_UNAVAILABLE" });
    }
    try {
      const result = await dependencies.workspaces.deleteFolder({
        itemId: params.data.folderId,
        expectedVersion: body.data.expectedVersion,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return sendNavigationDeleteResult(reply, result, "FOLDER");
    } catch (error) {
      request.log.error({ err: error }, "FOLDER_DELETE_FAILED");
      return reply.code(500).send({ code: "FOLDER_DELETE_FAILED" });
    }
  });

  app.patch("/v1/collections/:collectionId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = collectionIdParamsSchema.safeParse(request.params);
    const body = updateNavigationItemSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.workspaces.updateCollection) {
      return reply.code(503).send({ code: "COLLECTION_UPDATE_UNAVAILABLE" });
    }
    try {
      const result = await dependencies.workspaces.updateCollection({
        ...body.data,
        itemId: params.data.collectionId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return sendNavigationUpdateResult(reply, result, "COLLECTION");
    } catch (error) {
      request.log.error({ err: error }, "COLLECTION_UPDATE_FAILED");
      return reply.code(500).send({ code: "COLLECTION_UPDATE_FAILED" });
    }
  });

  app.patch("/v1/folders/:folderId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = folderIdParamsSchema.safeParse(request.params);
    const body = updateFolderNavigationSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.workspaces.updateFolder) {
      return reply.code(503).send({ code: "FOLDER_UPDATE_UNAVAILABLE" });
    }
    try {
      const result = await dependencies.workspaces.updateFolder({
        ...body.data,
        itemId: params.data.folderId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return sendNavigationUpdateResult(reply, result, "FOLDER");
    } catch (error) {
      request.log.error({ err: error }, "FOLDER_UPDATE_FAILED");
      return reply.code(500).send({ code: "FOLDER_UPDATE_FAILED" });
    }
  });

  app.post("/v1/workspaces/:workspaceId/requests", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = workspaceIdParamsSchema.safeParse(request.params);
    const body = createRequestSummarySchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    try {
      const createdRequest = await dependencies.workspaces.createRequest({
        ...body.data,
        workspaceId: params.data.workspaceId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return createdRequest
        ? reply.code(201).send(createdRequest)
        : reply.code(403).send({ code: "FORBIDDEN" });
    } catch (error) {
      request.log.error({ err: error }, "REQUEST_CREATE_FAILED");
      return reply.code(500).send({ code: "REQUEST_CREATE_FAILED" });
    }
  });

  app.get("/v1/workspaces/:workspaceId/tree", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind === "unavailable") {
      return reply.code(503).send({ code: "AUTHENTICATION_UNAVAILABLE" });
    }
    if (user.kind === "unauthorized") {
      return reply.code(401).send({ code: "UNAUTHORIZED" });
    }
    const params = workspaceIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    try {
      const tree = await dependencies.workspaces.getTree({
        workspaceId: params.data.workspaceId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
      });
      return tree
        ? reply.code(200).send(tree)
        : reply.code(404).send({ code: "NOT_FOUND" });
    } catch (error) {
      request.log.error({ err: error }, "WORKSPACE_TREE_FAILED");
      return reply.code(500).send({ code: "WORKSPACE_TREE_FAILED" });
    }
  });

  app.get("/v1/requests/:requestId/revisions", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply.code(user.kind === "unavailable" ? 503 : 401).send({
        code:
          user.kind === "unavailable"
            ? "AUTHENTICATION_UNAVAILABLE"
            : "UNAUTHORIZED",
      });
    }
    const params = requestIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.requests.listRevisions) {
      return reply.code(503).send({ code: "REVISIONS_UNAVAILABLE" });
    }
    try {
      const revisions = await dependencies.requests.listRevisions({
        requestId: params.data.requestId,
        accessToken: user.user.accessToken,
      });
      return revisions
        ? reply.code(200).send(revisions)
        : reply.code(404).send({ code: "NOT_FOUND" });
    } catch (error) {
      request.log.error({ err: error }, "REVISION_LIST_FAILED");
      return reply.code(500).send({ code: "REVISION_LIST_FAILED" });
    }
  });

  app.post("/v1/requests/:requestId/restore", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply.code(user.kind === "unavailable" ? 503 : 401).send({
        code:
          user.kind === "unavailable"
            ? "AUTHENTICATION_UNAVAILABLE"
            : "UNAUTHORIZED",
      });
    }
    const params = requestIdParamsSchema.safeParse(request.params);
    const body = restoreRequestRevisionSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    if (!dependencies.requests.restore) {
      return reply.code(503).send({ code: "REVISIONS_UNAVAILABLE" });
    }
    try {
      const result = await dependencies.requests.restore({
        requestId: params.data.requestId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
        ...body.data,
      });
      if (result.kind === "forbidden") {
        return reply.code(403).send({ code: "FORBIDDEN" });
      }
      if (result.kind === "not-found") {
        return reply.code(404).send({ code: "NOT_FOUND" });
      }
      if (result.kind === "conflict") {
        return reply.code(409).send(result.conflict);
      }
      return reply.code(200).send(result.request);
    } catch (error) {
      request.log.error({ err: error }, "REVISION_RESTORE_FAILED");
      return reply.code(500).send({ code: "REVISION_RESTORE_FAILED" });
    }
  });

  app.get("/v1/requests/:requestId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = requestIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    try {
      const persistedRequest = await dependencies.requests.find({
        requestId: params.data.requestId,
        accessToken: user.user.accessToken,
      });
      return persistedRequest
        ? reply.code(200).send(persistedRequest)
        : reply.code(404).send({ code: "NOT_FOUND" });
    } catch (error) {
      request.log.error({ err: error }, "REQUEST_READ_FAILED");
      return reply.code(500).send({ code: "REQUEST_READ_FAILED" });
    }
  });

  app.patch("/v1/requests/:requestId", async (request, reply) => {
    let user: AuthenticatedUser | null;
    try {
      user = await dependencies.authenticate(request.headers.authorization);
    } catch (error) {
      request.log.error({ err: error }, "AUTHENTICATION_UNAVAILABLE");
      return reply.code(503).send({
        code: "AUTHENTICATION_UNAVAILABLE",
        message: "Die Anmeldung kann momentan nicht geprüft werden.",
      });
    }
    if (!user) {
      return reply.code(401).send({
        code: "UNAUTHORIZED",
        message: "Eine gültige Anmeldung ist erforderlich.",
      });
    }

    const params = requestIdParamsSchema.safeParse(request.params);
    const body = updateRequestSchema.safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({
        code: "INVALID_REQUEST",
        message: "Die Anfrage ist ungültig.",
      });
    }

    const { expectedVersion, overwrite, ...draft } = body.data;
    try {
      const result = await dependencies.requests.update({
        requestId: params.data.requestId,
        userId: user.id,
        accessToken: user.accessToken,
        expectedVersion,
        draft,
        changeType: overwrite ? "overwrite" : "update",
      });

      if (result.kind === "forbidden") {
        return reply.code(403).send({ code: "FORBIDDEN" });
      }
      if (result.kind === "not-found") {
        return reply.code(404).send({ code: "NOT_FOUND" });
      }
      if (result.kind === "conflict") {
        return reply.code(409).send(result.conflict);
      }
      return reply.code(200).send(result.request);
    } catch (error) {
      request.log.error({ err: error }, "INTERNAL_ERROR");
      return reply.code(500).send({
        code: "INTERNAL_ERROR",
        message: "Der Request konnte nicht gespeichert werden.",
      });
    }
  });

  app.delete("/v1/requests/:requestId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
      request.log,
    );
    if (user.kind !== "authenticated") {
      return reply
        .code(user.kind === "unavailable" ? 503 : 401)
        .send({
          code:
            user.kind === "unavailable"
              ? "AUTHENTICATION_UNAVAILABLE"
              : "UNAUTHORIZED",
        });
    }
    const params = requestIdParamsSchema.safeParse(request.params);
    const body = deleteRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        code: "INVALID_REQUEST",
        message: "Die Löschanfrage ist ungültig.",
      });
    }
    if (!dependencies.requests.remove) {
      return reply.code(503).send({ code: "REQUEST_DELETE_UNAVAILABLE" });
    }
    try {
      const result = await dependencies.requests.remove({
        requestId: params.data.requestId,
        userId: user.user.id,
        accessToken: user.user.accessToken,
        expectedVersion: body.data.expectedVersion,
      });
      if (result.kind === "forbidden") {
        return reply.code(403).send({ code: "FORBIDDEN" });
      }
      if (result.kind === "not-found") {
        return reply.code(404).send({ code: "NOT_FOUND" });
      }
      if (result.kind === "conflict") {
        return reply.code(409).send(result.conflict);
      }
      return reply.code(204).send();
    } catch (error) {
      request.log.error({ err: error }, "REQUEST_DELETE_FAILED");
      return reply.code(500).send({
        code: "REQUEST_DELETE_FAILED",
        message: "Der Request konnte nicht gelöscht werden.",
      });
    }
  });

  return app;
}

type AuthenticationResult =
  | { kind: "authenticated"; user: AuthenticatedUser }
  | { kind: "unauthorized" }
  | { kind: "unavailable" };

function sendNavigationDeleteResult(
  reply: FastifyReply,
  result: DeleteNavigationItemResult,
  resource: "COLLECTION" | "FOLDER",
) {
  if (result.kind === "deleted") return reply.code(204).send();
  if (result.kind === "forbidden") {
    return reply.code(403).send({ code: "FORBIDDEN" });
  }
  if (result.kind === "not-found") {
    return reply.code(404).send({ code: "NOT_FOUND" });
  }
  if (result.kind === "conflict") {
    return reply.code(409).send({
      code: `${resource}_VERSION_CONFLICT`,
      message: "Das Element wurde zwischenzeitlich geändert.",
    });
  }
  return reply.code(409).send({
    code: `${resource}_NOT_EMPTY`,
    message:
      resource === "COLLECTION"
        ? "Die Collection enthält noch Requests oder Ordner."
        : "Der Ordner enthält noch Requests oder Unterordner.",
  });
}

function sendNavigationUpdateResult(
  reply: FastifyReply,
  result: UpdateCollectionResult | UpdateFolderResult,
  resource: "COLLECTION" | "FOLDER",
) {
  if (result.kind === "updated") return reply.code(200).send(result.item);
  if (result.kind === "forbidden") {
    return reply.code(403).send({ code: "FORBIDDEN" });
  }
  if (result.kind === "not-found") {
    return reply.code(404).send({ code: "NOT_FOUND" });
  }
  return reply.code(409).send({
    code: `${resource}_VERSION_CONFLICT`,
    message: "Das Element wurde zwischenzeitlich geändert.",
  });
}

async function authenticateSafely(
  authenticate: Authenticator,
  authorizationHeader: string | undefined,
  logger?: FastifyBaseLogger,
): Promise<AuthenticationResult> {
  try {
    const user = await authenticate(authorizationHeader);
    return user
      ? { kind: "authenticated", user }
      : { kind: "unauthorized" };
  } catch (error) {
    logger?.error({ err: error }, "AUTHENTICATION_UNAVAILABLE");
    return { kind: "unavailable" };
  }
}

async function recordExecutionSafely(
  repository: ExecutionHistoryRepository | undefined,
  command: RecordExecutionCommand,
  logger?: FastifyBaseLogger,
): Promise<void> {
  if (!repository) return;
  try {
    await repository.record(command);
  } catch (error) {
    // Die Historie enthält nur Diagnosemetadaten und darf eine ansonsten
    // erfolgreiche Request-Ausführung nicht fehlschlagen lassen.
    logger?.warn({ err: error }, "EXECUTION_HISTORY_RECORD_FAILED");
  }
}
