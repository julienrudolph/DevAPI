import {
  requestExecutionsSchema,
  type RequestExecution,
} from "@api-client/contracts";

export async function fetchExecutionHistory(
  workspaceId: string,
  accessToken: string,
): Promise<RequestExecution[]> {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/executions`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error(`EXECUTION_HISTORY_${response.status}`);
  return requestExecutionsSchema.parse(await response.json());
}
