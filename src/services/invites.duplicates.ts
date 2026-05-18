import type { MemberStatus } from "@/lib/api/types";

export function isBlockingInviteDuplicateStatus(status: MemberStatus): boolean {
  return status !== "removed";
}
