import { z } from "zod";

export const workspaceRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export function canEdit(role: WorkspaceRole): boolean {
  return role === "owner" || role === "editor";
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === "owner";
}

