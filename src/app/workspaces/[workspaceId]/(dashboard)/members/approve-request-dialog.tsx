"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { workspaceRoleLabel } from "@/lib/api/labels";
import type { GroupSummary } from "@/lib/api/types";
import { approveJoinRequest } from "@/services/join-requests";
import type { JoinRequestListItem } from "@/services/join-requests";

type GrantRole = "instructor" | "group_admin";

type Props = {
  request: JoinRequestListItem | null;
  workspaceId: string;
  groups: GroupSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ApproveRequestDialog({
  request,
  workspaceId,
  groups,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [role, setRole] = useState<GrantRole>("instructor");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && request) {
      // 요청자의 희망 역할을 기본값으로
      setRole(
        request.desiredRole === "group_admin" ? "group_admin" : "instructor",
      );
      setGroupIds([]);
      setError(null);
    }
    if (!open) {
      const t = setTimeout(() => {
        setSubmitting(false);
        setError(null);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, request]);

  if (!request) return null;

  const groupOptions = groups.map((g) => ({ id: g.id, label: g.name }));

  async function handleSubmit() {
    if (!request) return;
    if (role === "group_admin" && groupIds.length === 0) {
      setError("그룹 운영자는 1개 이상의 그룹을 선택해야 합니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await approveJoinRequest(workspaceId, request.id, {
      role,
      groupIds: role === "group_admin" ? groupIds : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success(
      `${request.user.displayName ?? request.user.email}님을 ${workspaceRoleLabel(role)}로 추가했습니다.`,
    );
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader
        title="참여 요청 수락"
        description={`${request.user.email} 님의 요청을 수락하고 역할을 부여합니다.`}
      />
      <DialogBody>
        <div className="rounded-[var(--radius-md)] bg-[var(--color-muted)]/40 px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
          요청자 희망 역할: <span className="font-medium text-[var(--color-foreground)]">{workspaceRoleLabel(request.desiredRole)}</span>
          {request.message && (
            <>
              <br />
              <span className="mt-1 block whitespace-pre-line text-[var(--color-foreground)]/80">
                “{request.message}”
              </span>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="approve-role">부여할 역할</Label>
          <Select
            id="approve-role"
            value={role}
            onChange={(e) => setRole(e.target.value as GrantRole)}
          >
            <option value="instructor">강사</option>
            <option value="group_admin">그룹 운영자</option>
          </Select>
        </div>

        {role === "group_admin" && (
          <div className="space-y-1.5">
            <Label>접근 그룹</Label>
            <MultiSelect
              options={groupOptions}
              selectedIds={groupIds}
              onChange={setGroupIds}
              placeholder="그룹을 선택하세요"
            />
            <p className="text-xs text-[var(--color-muted-foreground)]">
              선택한 그룹의 수업·참여자·자료에만 접근 가능합니다.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "처리 중..." : "수락"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
