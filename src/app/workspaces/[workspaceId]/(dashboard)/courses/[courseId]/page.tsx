import { redirect } from 'next/navigation';

type CourseDetailPageProps = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { workspaceId, courseId } = await params;
  redirect(`/workspaces/${workspaceId}/courses/${courseId}/home`);
}
