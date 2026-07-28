import {
  requestIdParamsSchema,
  updateRequestSchema,
  workspaceRoleSchema,
} from "@api-client/contracts";
import Fastify from "fastify";

import { InMemoryRequestStore } from "./domain/request-store.js";

const actorHeadersSchema = workspaceRoleSchema;

export function buildApp(store = new InMemoryRequestStore()) {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  app.patch("/v1/requests/:requestId", async (request, reply) => {
    const params = requestIdParamsSchema.safeParse(request.params);
    const body = updateRequestSchema.safeParse(request.body);
    const role = actorHeadersSchema.safeParse(request.headers["x-demo-role"]);
    const actorId = request.headers["x-demo-user-id"];

    if (
      !params.success ||
      !body.success ||
      !role.success ||
      typeof actorId !== "string"
    ) {
      return reply.code(400).send({
        code: "INVALID_REQUEST",
        message: "Die Anfrage ist ungültig.",
      });
    }

    const { expectedVersion, ...draft } = body.data;
    const result = store.update({
      requestId: params.data.requestId,
      expectedVersion,
      draft,
      actor: { id: actorId, displayName: "Demo", role: role.data },
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
  });

  return app;
}
