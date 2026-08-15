import type {
  ExecuteRequest,
  ProxyResponse,
} from "@api-client/contracts";

export interface RequestExecutionContext {
  // Forwarded to the proxy as X-Correlation-Id so a single logical request
  // shares one ID across both hops for log correlation (AGENTS.md 14).
  correlationId: string;
}

export interface RequestExecutor {
  execute(
    input: ExecuteRequest,
    context: RequestExecutionContext,
  ): Promise<ProxyResponse>;
}

export class RequestExecutionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
