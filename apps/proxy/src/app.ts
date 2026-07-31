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
  maxConcurrentRequests?: number;
}

type TargetFailure = {
  code: string;
  message: string;
  status: number;
};

export function classifyTargetFailure(error: unknown): TargetFailure {
  const codes = errorCodes(error);
  if (codes.some((code) => ["ENOTFOUND", "EAI_AGAIN"].includes(code))) {
    return {
      code: "TARGET_DNS_FAILED",
      message:
        "Der Hostname konnte nicht aufgelöst werden. Prüfe Domain und Schreibweise der URL.",
      status: 502,
    };
  }
  if (codes.includes("ECONNREFUSED")) {
    return {
      code: "TARGET_CONNECTION_REFUSED",
      message:
        "Der Zielserver hat die Verbindung abgelehnt. Prüfe Host, Port und ob der Dienst erreichbar ist.",
      status: 502,
    };
  }
  if (
    codes.some((code) =>
      ["ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"].includes(
        code,
      ),
    )
  ) {
    return {
      code: "TARGET_UNREACHABLE",
      message:
        "Der Zielserver ist aus dem Servernetz nicht erreichbar. Prüfe URL, Port, Firewall und DNS.",
      status: 502,
    };
  }
  if (
    codes.some(
      (code) =>
        code.startsWith("ERR_TLS_") ||
        code.startsWith("CERT_") ||
        code.includes("CERTIFICATE"),
    )
  ) {
    return {
      code: "TARGET_TLS_FAILED",
      message:
        "Die sichere TLS-Verbindung zum Zielserver konnte nicht geprüft werden. Prüfe Zertifikat und Hostnamen.",
      status: 502,
    };
  }
  return {
    code: "TARGET_REQUEST_FAILED",
    message:
      "Der Zielserver konnte nicht erreicht werden. Prüfe URL, DNS, Port und Erreichbarkeit vom DevAPI-Server.",
    status: 502,
  };
}

function errorCodes(error: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { cause?: unknown; code?: unknown };
    if (typeof candidate.code === "string") codes.push(candidate.code);
    current = candidate.cause;
  }
  return codes;
}

export function buildProxyApp(options: ProxyAppOptions = {}) {
  const transport = options.transport ?? undiciTransport;
  const authenticate =
    options.authenticate ?? createServiceTokenAuthenticator();
  const maxConcurrentRequests = options.maxConcurrentRequests ?? 50;
  let activeExecutions = 0;
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
    if (activeExecutions >= maxConcurrentRequests) {
      return reply
        .header("Retry-After", 1)
        .code(429)
        .send({
          code: "PROXY_CAPACITY_LIMITED",
          message:
            "Der Request-Proxy ist ausgelastet. Warte kurz und versuche es erneut.",
        });
    }

    activeExecutions += 1;
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
      const failure = classifyTargetFailure(error);
      return reply.code(failure.status).send({
        code: failure.code,
        message: failure.message,
      });
    } finally {
      activeExecutions = Math.max(0, activeExecutions - 1);
    }
  });

  return app;
}
