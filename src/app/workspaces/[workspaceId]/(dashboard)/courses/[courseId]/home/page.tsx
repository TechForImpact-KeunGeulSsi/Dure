import { getCourseHomePageData } from '@/services/courses-mock';

import { CourseHomeClient } from './course-home-client';

type CourseHomePageProps = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function CourseHomePage({ params }: CourseHomePageProps) {
  const { workspaceId, courseId } = await params;
  const data = await getCourseHomePageData({ workspaceId, courseId });

  return <CourseHomeClient data={data} />;
}
