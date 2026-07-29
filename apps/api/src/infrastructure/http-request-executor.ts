import {
  proxyResponseSchema,
  type ExecuteRequest,
  type ProxyResponse,
} from "@api-client/contracts";
import { z } from "zod";

import {
  RequestExecutionError,
  type RequestExecutor,
} from "../domain/request-executor.js";

const proxyErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export class HttpRequestExecutor implements RequestExecutor {
  constructor(
    private readonly proxyUrl: string,
    private readonly internalToken: string,
  ) {}

  async execute(input: ExecuteRequest): Promise<ProxyResponse> {
    const response = await fetch(new URL("/v1/execute", this.proxyUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.internalToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20_000),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const error = proxyErrorSchema.safeParse(body);
      throw new RequestExecutionError(
        response.status,
        error.success ? error.data.code : "PROXY_REQUEST_FAILED",
        error.success
          ? error.data.message
          : "Der Request konnte nicht ausgeführt werden.",
      );
    }
    return proxyResponseSchema.parse(body);
  }
}
