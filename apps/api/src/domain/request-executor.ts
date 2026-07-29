import type {
  ExecuteRequest,
  ProxyResponse,
} from "@api-client/contracts";

export interface RequestExecutor {
  execute(input: ExecuteRequest): Promise<ProxyResponse>;
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
