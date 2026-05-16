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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  GroupSummary,
  MemberStatus,
  WorkspaceRole,
} from "@/lib/api/types";
import { updateMember } from "@/services/workspace-members";
import type { WorkspaceMemberListItem } from "@/services/workspace-members";

type EditableStatus = Extract<MemberStatus, "active" | "disabled" | "removed">;

type Props = {
  member: WorkspaceMemberListItem | null;
  workspaceId: string;
  groups: GroupSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ROLE_OPTIONS: Array<{ value: WorkspaceRole; label: string }> = [
  { value: "owner_admin", label: "대표 운영자" },
  { value: "group_admin", label: "그룹 운영자" },
  { value: "instructor", label: "강사" },
];

const STATUS_OPTIONS: Array<{ value: EditableStatus; label: string }> = [
  { value: "active", label: "활성" },
  { value: "disabled", label: "비활성" },
  { value: "removed", label: "제외" },
];

function sameSet<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const v of b) if (!sa.has(v)) return false;
  return true;
}

export function EditMemberDialog({
  member,
  workspaceId,
  groups,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [memo, setMemo] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("instructor");
  const [status, setStatus] = useState<EditableStatus>("active");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && member) {
      setDisplayName(member.displayName ?? "");
      setMemo(member.memo ?? "");
      setRole(member.role);
      // status가 invited이면 active로 기본값 잡되, 저장 안 하면 변경 안 됨
      setStatus(member.status === "invited" ? "active" : member.status);
      setGroupIds(member.groupIds);
      setError(null);
    }
  }, [open, member]);

  if (!member) return null;

  const isInvitedMember = member.status === "invited";
  const groupOptions = groups.map((g) => ({ id: g.id, label: g.name }));

  async function handleSubmit() {
    if (!member) return;
    setError(null);

    if (role === "group_admin" && groupIds.length === 0) {
      setError("그룹 운영자는 1개 이상의 그룹을 선택해야 합니다.");
      return;
    }

    if (status === "removed" && member.status !== "removed") {
      const confirmed = window.confirm(
        "이 멤버를 워크스페이스에서 제외합니다.\n이름과 기록은 보존되지만 더 이상 접근할 수 없습니다.\n계속하시겠어요?",
      );
      if (!confirmed) return;
    }

    const payload: Parameters<typeof updateMember>[2] = {};
    const trimmedName = displayName.trim();
    const nextName = trimmedName.length > 0 ? trimmedName : null;
    if (nextName !== member.displayName) payload.displayName = nextName;

    const trimmedMemo = memo.trim();
    const nextMemo = trimmedMemo.length > 0 ? trimmedMemo : null;
    if (nextMemo !== member.memo) payload.memo = nextMemo;

    if (role !== member.role) payload.role = role;
    if (!isInvitedMember && status !== member.status) payload.status = status;

    // groupIds: role이 group_admin이고 변경됐을 때만 전송. role이 다른 값으로
    // 바뀌면 서버에서 자동으로 기존 그룹 매핑을 정리해주므로 클라이언트에선
    // groupIds를 보낼 필요 없음.
    if (role === "group_admin" && !sameSet(groupIds, member.groupIds)) {
      payload.groupIds = groupIds;
    }

    if (Object.keys(payload).length === 0) {
      toast.info("변경된 내용이 없습니다.");
      return;
    }

    setSubmitting(true);
    const result = await updateMember(workspaceId, member.id, payload);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("멤버 정보를 저장했습니다.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader
        title="멤버 정보 수정"
        description="표시 이름·역할·상태·메모를 수정합니다."
      />
      <DialogBody>
        <div className="rounded-[var(--radius-md)] bg-[var(--color-muted)]/40 px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
          이메일: <span className="font-medium text-[var(--color-foreground)]">{member.email}</span>
          {member.isCurrentUser && (
            <span className="ml-2 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
              나
            </span>
          )}
          {isInvitedMember && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              초대 대기 — 상태는 수락 후 변경 가능
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="member-display-name">표시 이름</Label>
          <Input
            id="member-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            placeholder="예: 김운영"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="member-memo">메모 (운영자용, 500자)</Label>
          <Textarea
            id="member-memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="예: 주중 강의 담당. 화/목 4-6시 가용."
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="member-role">역할</Label>
            <Select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-status">상태</Label>
            <Select
              id="member-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EditableStatus)}
              disabled={isInvitedMember}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
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
              선택한 그룹의 수업·참여자·자료에만 접근할 수 있습니다.
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
          {submitting ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
