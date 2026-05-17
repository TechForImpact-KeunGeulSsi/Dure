import { EmptyState } from "@/components/courses/empty-state";
import { getMyPayoutAccount } from "@/services/payout-accounts";
import { listMySettlementRequestsForCourse } from "@/services/settlements";

import { InstructorSettlementsClient } from "./settlements-client";

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function InstructorSettlementsPage({ params }: Props) {
  const { workspaceId, courseId } = await params;

  const [accountResult, requestsResult] = await Promise.all([
    getMyPayoutAccount(workspaceId),
    listMySettlementRequestsForCourse(workspaceId, courseId),
  ]);

  if (!accountResult.ok) {
    return <EmptyState message={accountResult.error.message} />;
  }
  if (!requestsResult.ok) {
    return <EmptyState message={requestsResult.error.message} />;
  }

  return (
    <InstructorSettlementsClient
      workspaceId={workspaceId}
      courseId={courseId}
      initialAccount={accountResult.data.account}
      initialRequests={requestsResult.data.requests}
    />
  );
}
