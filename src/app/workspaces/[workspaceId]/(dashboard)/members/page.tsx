import { EmptyState } from '@/components/courses/empty-state';
import { getGroupsPage } from '@/services/groups';
import { getWorkspaceMembers } from '@/services/workspace-members';

import { MembersClient } from './members-client';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function MembersPage({ params }: Props) {
  const { workspaceId } = await params;
  const [membersResult, groupsResult] = await Promise.all([
    getWorkspaceMembers(workspaceId),
    getGroupsPage({ workspaceId, status: 'active', pageSize: 100 }),
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

  return (
    <MembersClient
      workspaceId={workspaceId}
      initial={membersResult.data}
      groups={activeGroups}
    />
  );
}
