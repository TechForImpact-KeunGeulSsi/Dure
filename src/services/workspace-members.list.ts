import type { MemberStatus, UUID, WorkspaceRole } from "../lib/api/types";

export type WorkspaceMemberRow = {
  id: UUID;
  email: string;
  display_name: string | null;
  memo: string | null;
  role: WorkspaceRole;
  status: MemberStatus;
  user_id: string | null;
};

export type WorkspaceMemberListItem = {
  id: UUID;
  email: string;
  displayName: string | null;
  memo: string | null;
  role: WorkspaceRole;
  status: MemberStatus;
  groupIds: UUID[];
  isCurrentUser: boolean;
};

export function buildWorkspaceMemberList({
  rows,
  groupsByMember,
  currentUserId,
}: {
  rows: WorkspaceMemberRow[];
  groupsByMember: Map<UUID, UUID[]>;
  currentUserId: string;
}): WorkspaceMemberListItem[] {
  return rows
    .filter((row) => row.status !== "removed")
    .map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      memo: row.memo,
      role: row.role,
      status: row.status,
      groupIds: groupsByMember.get(row.id) ?? [],
      isCurrentUser: row.user_id === currentUserId,
    }));
}
