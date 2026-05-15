import { getDashboardCourses } from '@/services/courses';

import { DashboardHomeClient } from './home-client';

type DashboardHomePageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function DashboardHomePage({ params }: DashboardHomePageProps) {
  const { workspaceId } = await params;
  const courses = await getDashboardCourses(workspaceId);

  return <DashboardHomeClient workspaceId={workspaceId} courses={courses} />;
}
