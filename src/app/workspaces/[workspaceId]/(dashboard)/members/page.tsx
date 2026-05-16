import { EmptyState } from '@/components/courses/empty-state';
import { getWorkspaceMembers } from '@/services/workspace-members';

import { MembersClient } from './members-client';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function MembersPage({ params }: Props) {
  const { workspaceId } = await params;
  const result = await getWorkspaceMembers(workspaceId);

  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  return (
    <MembersClient
      workspaceId={workspaceId}
      initial={result.data}
    />
  );
}