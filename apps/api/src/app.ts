import {
  requestIdParamsSchema,
  updateRequestSchema,
} from "@api-client/contracts";
import Fastify from "fastify";

import type {
  AuthenticatedUser,
  Authenticator,
} from "./auth/authenticator.js";
import type { RequestRepository } from "./domain/request-repository.js";

export interface ApiDependencies {
  authenticate: Authenticator;
  requests: RequestRepository;
}

export function buildApp(dependencies: ApiDependencies) {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

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

    const { expectedVersion, ...draft } = body.data;
    try {
      const result = await dependencies.requests.update({
        requestId: params.data.requestId,
        userId: user.id,
        accessToken: user.accessToken,
        expectedVersion,
        draft,
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
