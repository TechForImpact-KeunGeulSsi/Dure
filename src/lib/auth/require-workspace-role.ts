import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberSummary, UUID, WorkspaceRole } from "@/lib/api/types";

import { requireUser } from "./require-user";

type RequireWorkspaceMembershipOptions = {
  workspaceId: UUID;
  allowedRoles?: WorkspaceRole[];
  /**
   * When the user has no active membership in the workspace, redirect to this
   * path instead of throwing. Default: /workspaces.
   */
  onMissingRedirectTo?: string;
};

export type WorkspaceMembership = {
  member: MemberSummary;
};

/**
 * Resolves the current user's active membership in the given workspace.
 *
 * - Redirects to /login if not authenticated.
 * - Redirects to /workspaces (or `onMissingRedirectTo`) when there is no
 *   active membership — the user has no business being on this page.
 * - When `allowedRoles` is provided, an active member whose role is outside
 *   the allowed list is sent to /workspaces/{id}/home (the safe landing).
 *
 * Permission is verified server-side regardless of client-side hints
 * The service layer is the authoritative permission boundary.
 */
export async function requireWorkspaceMembership(
  options: RequireWorkspaceMembershipOptions,
): Promise<WorkspaceMembership> {
  const { workspaceId, allowedRoles, onMissingRedirectTo = "/workspaces" } =
    options;

  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, email, display_name, role, status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    redirect(onMissingRedirectTo);
  }

  const member: MemberSummary = {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    status: data.status,
  };

  if (allowedRoles && !allowedRoles.includes(member.role)) {
    redirect(`/workspaces/${workspaceId}/home`);
  }

  return { member };
}
