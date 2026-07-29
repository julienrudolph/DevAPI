import {
  createCollectionSchema,
  createFolderSchema,
  createRequestSummarySchema,
  createWorkspaceSchema,
  requestIdParamsSchema,
  updateRequestSchema,
  workspaceIdParamsSchema,
} from "@api-client/contracts";
import Fastify from "fastify";

import type {
  AuthenticatedUser,
  Authenticator,
} from "./auth/authenticator.js";
import type { RequestRepository } from "./domain/request-repository.js";
import type { WorkspaceRepository } from "./domain/workspace-repository.js";

export interface ApiDependencies {
  authenticate: Authenticator;
  requests: RequestRepository;
  workspaces: WorkspaceRepository;
}

export function buildApp(dependencies: ApiDependencies) {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/v1/workspaces", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
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
    } catch {
      return reply.code(500).send({ code: "WORKSPACE_LIST_FAILED" });
    }
  });

  app.post("/v1/workspaces", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
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
      return reply.code(201).send(workspace);
    } catch {
      return reply.code(500).send({ code: "WORKSPACE_CREATE_FAILED" });
    }
  });

  app.post("/v1/workspaces/:workspaceId/collections", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
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
    } catch {
      return reply.code(500).send({ code: "COLLECTION_CREATE_FAILED" });
    }
  });

  app.post("/v1/workspaces/:workspaceId/folders", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
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
    } catch {
      return reply.code(500).send({ code: "FOLDER_CREATE_FAILED" });
    }
  });

  app.post("/v1/workspaces/:workspaceId/requests", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
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
    } catch {
      return reply.code(500).send({ code: "REQUEST_CREATE_FAILED" });
    }
  });

  app.get("/v1/workspaces/:workspaceId/tree", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
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
    } catch {
      return reply.code(500).send({ code: "WORKSPACE_TREE_FAILED" });
    }
  });

  app.get("/v1/requests/:requestId", async (request, reply) => {
    const user = await authenticateSafely(
      dependencies.authenticate,
      request.headers.authorization,
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
    } catch {
      return reply.code(500).send({ code: "REQUEST_READ_FAILED" });
    }
  });

  app.patch("/v1/requests/:requestId", async (request, reply) => {
    let user: AuthenticatedUser | null;
    try {
      user = await dependencies.authenticate(request.headers.authorization);
    } catch {
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
    } catch {
      return reply.code(500).send({
        code: "INTERNAL_ERROR",
        message: "Der Request konnte nicht gespeichert werden.",
      });
    }
  });

  return app;
}

type AuthenticationResult =
  | { kind: "authenticated"; user: AuthenticatedUser }
  | { kind: "unauthorized" }
  | { kind: "unavailable" };

async function authenticateSafely(
  authenticate: Authenticator,
  authorizationHeader: string | undefined,
): Promise<AuthenticationResult> {
  try {
    const user = await authenticate(authorizationHeader);
    return user
      ? { kind: "authenticated", user }
      : { kind: "unauthorized" };
  } catch {
    return { kind: "unavailable" };
  }
}
