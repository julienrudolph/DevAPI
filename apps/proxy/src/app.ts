import { executeRequestSchema } from "@api-client/contracts";
import Fastify from "fastify";

import {
  executeHttpRequest,
  RedirectLimitError,
  ResponseTooLargeError,
  type Transport,
} from "./execution/executor.js";
import { undiciTransport } from "./execution/undici-transport.js";
import {
  createServiceTokenAuthenticator,
  type ProxyAuthenticator,
} from "./security/authentication.js";
import { UnsafeHeaderError } from "./security/headers.js";
import { UnsafeTargetError } from "./security/target-policy.js";

export interface ProxyAppOptions {
  transport?: Transport;
  authenticate?: ProxyAuthenticator;
}

export function buildProxyApp(options: ProxyAppOptions = {}) {
  const transport = options.transport ?? undiciTransport;
  const authenticate =
    options.authenticate ?? createServiceTokenAuthenticator();
  const app = Fastify({
    logger: false,
    bodyLimit: 1_100_000,
    requestTimeout: 15_000,
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/v1/execute", async (request, reply) => {
    if (!(await authenticate(request.headers.authorization))) {
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
      const result = await executeHttpRequest(input.data, { transport });
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof UnsafeTargetError) {
        return reply.code(403).send({
          code: "UNSAFE_TARGET",
          message: error.message,
        });
      }
      if (error instanceof UnsafeHeaderError) {
        return reply.code(400).send({
          code: "UNSAFE_HEADER",
          message: error.message,
        });
      }
      if (error instanceof ResponseTooLargeError) {
        return reply.code(413).send({
          code: "RESPONSE_TOO_LARGE",
          message: error.message,
        });
      }
      if (error instanceof RedirectLimitError) {
        return reply.code(502).send({
          code: "REDIRECT_LIMIT_EXCEEDED",
          message: error.message,
        });
      }
      if (error instanceof Error && error.name === "AbortError") {
        return reply.code(504).send({
          code: "TARGET_TIMEOUT",
          message: "Das Ziel hat nicht rechtzeitig geantwortet.",
        });
      }
      return reply.code(502).send({
        code: "TARGET_REQUEST_FAILED",
        message: "Der Request konnte nicht sicher ausgeführt werden.",
      });
    }
  });

  return app;
}
