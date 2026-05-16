import { EmptyState } from '@/components/courses/empty-state';
import { getCourseMaterials } from '@/services/materials';

import { MaterialsClient } from '../../../../courses/[courseId]/materials/materials-client';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

/**
 * 강사용 자료 탭. 단계 6 service/UI 그대로 재사용.
 * 권한 플래그(`canEdit`/`canChangeReviewStatus`/`canDownload`)가 이미 강사 케이스를
 * 처리하므로 별도 분기가 필요 없다(api-spec.md §14 추가 제한).
 */
export default async function InstructorMaterialsPage({ params }: Props) {
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