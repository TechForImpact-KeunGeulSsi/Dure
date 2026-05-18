import type { ApiResult } from "@/lib/api/errors";
import type { UUID } from "@/lib/api/types";
import type { removeMember } from "./workspace-members";

type RemoveMemberResult = Awaited<ReturnType<typeof removeMember>>;

declare const result: RemoveMemberResult;

const _assertRemoveMemberContract: ApiResult<{ memberId: UUID }> = result;

void _assertRemoveMemberContract;
