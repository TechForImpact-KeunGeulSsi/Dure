import { EmptyState } from '@/components/courses/empty-state';
import { getCoursesPage } from '@/services/courses';
import type { DashboardCourseItem } from '@/types/course';

import { DashboardHomeClient } from './home-client';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function DashboardHomePage({ params }: Props) {
  const { workspaceId } = await params;
  const result = await getCoursesPage({ workspaceId, pageSize: 100 });

  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  // home-client는 단계 5에서 DashboardCourseItem 형태를 기대한다.
  // nextSession / pendingMaterialCount 는 단계 5 카드 UI에서 사용하지 않으므로
  // null/0 으로 채워 호환성을 유지한다(단계 7에서 실 데이터로 보강 예정).
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

  return <DashboardHomeClient workspaceId={workspaceId} courses={courses} />;
}
