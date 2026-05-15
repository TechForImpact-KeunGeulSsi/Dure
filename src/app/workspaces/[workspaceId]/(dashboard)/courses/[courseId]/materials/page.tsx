import { EmptyState } from '@/components/courses/empty-state';
import { getCourseMaterials } from '@/services/materials';

import { MaterialsClient } from './materials-client';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function CourseMaterialsTabPage({ params }: Props) {
  const { workspaceId, courseId } = await params;
  const result = await getCourseMaterials({ workspaceId, courseId });

  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  return (
    <MaterialsClient
      workspaceId={workspaceId}
      courseId={courseId}
      initial={result.data}
    />
  );
}
