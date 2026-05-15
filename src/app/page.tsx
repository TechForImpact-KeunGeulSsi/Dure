import { redirect } from 'next/navigation';

import { getDefaultWorkspaceId } from '@/services/courses';

export default function RootPage() {
  redirect(`/workspaces/${getDefaultWorkspaceId()}/home`);
}
