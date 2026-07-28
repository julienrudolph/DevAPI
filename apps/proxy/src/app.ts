import { executeRequestSchema } from "@api-client/contracts";
import Fastify from "fastify";

import {
  resolvePublicTarget,
  UnsafeTargetError,
} from "./security/target-policy.js";

export function buildProxyApp() {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_100_000,
    requestTimeout: 15_000,
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/v1/execute", async (request, reply) => {
    if (typeof request.headers.authorization !== "string") {
      return reply.code(401).send({ code: "UNAUTHORIZED" });
    }
    const input = executeRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply.code(400).send({
        code: "INVALID_REQUEST",
        message: "Der auszuführende Request ist ungültig.",
      });
    }

    try {
      const target = await resolvePublicTarget(input.data.url);
      return reply.code(501).send({
        code: "EXECUTION_NOT_ENABLED",
        message:
          "Das Ziel wurde geprüft. Die Netzwerkausführung wird im nächsten Schritt aktiviert.",
        target: target.url.origin,
      });
    } catch (error) {
      if (error instanceof UnsafeTargetError) {
        return reply.code(403).send({
          code: "UNSAFE_TARGET",
          message: error.message,
        });
      }
      return reply.code(502).send({
        code: "TARGET_RESOLUTION_FAILED",
        message: "Das Ziel konnte nicht sicher aufgelöst werden.",
      });
    }
  });

  return app;
}
