import { EmptyState } from '@/components/courses/empty-state';
import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCoursesPage } from '@/services/courses';
import type { DashboardCourseItem } from '@/types/course';

import { DashboardHomeClient } from './home-client';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function DashboardHomePage({ params }: Props) {
  const { workspaceId } = await params;

  await requireUser();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = user
    ? await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
    : { data: null };

  const role = (me?.role ?? 'instructor') as 'owner_admin' | 'group_admin' | 'instructor';
  const viewType: 'manager' | 'instructor' =
    role === 'instructor' ? 'instructor' : 'manager';
  const canCreateCourse = role === 'owner_admin' || role === 'group_admin';

  const result = await getCoursesPage({ workspaceId, pageSize: 100 });
  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  const courses: DashboardCourseItem[] = result.data.courses.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    startsOn: c.startsOn,
    endsOn: c.endsOn,
    cardColor: c.cardColor,
    bannerUrl: c.bannerUrl,
    groups: c.groups,
    instructor: c.instructor,
    participantCount: c.participantCount,
    sessionCount: c.sessionCount,
    nextSession: null,
    pendingMaterialCount: 0,
  }));

  return (
    <DashboardHomeClient
      workspaceId={workspaceId}
      courses={courses}
      viewType={viewType}
      canCreateCourse={canCreateCourse}
    />
  );
}
