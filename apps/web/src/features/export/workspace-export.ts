import type {
  ApiRequest,
  WorkspaceSummary,
  WorkspaceTree,
} from "@api-client/contracts";

const sensitiveHeaders = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "x-api-key",
  "api-key",
]);

export function createWorkspaceExport(
  workspace: WorkspaceSummary,
  tree: WorkspaceTree,
  requests: ApiRequest[],
): Record<string, unknown> {
  return {
    format: "relay.workspace/v1",
    exportedAt: new Date().toISOString(),
    workspace: {
      name: workspace.name,
      collections: tree.collections.map(({ name, position, id }) => ({
        id,
        name,
        position,
      })),
      folders: tree.folders.map(
        ({
          id,
          collectionId,
          parentFolderId,
          name,
          position,
        }) => ({
          id,
          collectionId,
          parentFolderId,
          name,
          position,
        }),
      ),
      requests: requests.map((request) => ({
        collectionId: request.collectionId,
        folderId: request.folderId,
        name: request.name,
        method: request.method,
        url: request.url,
        queryParams: request.queryParams,
        headers: request.headers.map((header) => ({
          ...header,
          value: sensitiveHeaders.has(header.key.trim().toLowerCase())
            ? ""
            : header.value,
        })),
        body: request.body,
      })),
    },
  };
}

export function downloadWorkspaceExport(
  workspaceName: string,
  value: Record<string, unknown>,
): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(workspaceName)}.relay.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9ÄÖÜäöüß._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}
