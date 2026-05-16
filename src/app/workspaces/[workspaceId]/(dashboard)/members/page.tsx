import { EmptyState } from '@/components/courses/empty-state';
import { getGroupsPage } from '@/services/groups';
import { listWorkspaceJoinRequests } from '@/services/join-requests';
import { getWorkspaceMembers } from '@/services/workspace-members';

import { MembersClient } from './members-client';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function MembersPage({ params }: Props) {
  const { workspaceId } = await params;
  const [membersResult, groupsResult, joinRequestsResult] = await Promise.all([
    getWorkspaceMembers(workspaceId),
    getGroupsPage({ workspaceId, status: 'active', pageSize: 100 }),
    listWorkspaceJoinRequests(workspaceId, { status: 'pending' }),
  ]);

  if (!membersResult.ok) {
    return <EmptyState message={membersResult.error.message} />;
  }

  const activeGroups = groupsResult.ok
    ? groupsResult.data.groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        status: g.status,
      }))
    : [];

  // listWorkspaceJoinRequests는 owner_admin이 아닌 사용자에겐 ROLE_FORBIDDEN을
  // 반환하지만, members 페이지는 owner_admin 외에도 접근 가능하므로 실패해도
  // 그냥 빈 배열로 처리해 멤버 목록은 보여준다.
  const pendingRequests = joinRequestsResult.ok ? joinRequestsResult.data : [];

  return (
    <MembersClient
      workspaceId={workspaceId}
      initial={membersResult.data}
      groups={activeGroups}
      pendingRequests={pendingRequests}
    />
  );
}
