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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requestWorkspaceAccess } from "@/services/join-requests";
import type { DiscoverableWorkspaceItem } from "@/services/join-requests";

type DesiredRole = "instructor" | "group_admin";

type Props = {
  workspace: DiscoverableWorkspaceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RequestAccessDialog({ workspace, open, onOpenChange }: Props) {
  const router = useRouter();
  const [desiredRole, setDesiredRole] = useState<DesiredRole>("instructor");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // dialog 닫힐 때 초기화
      const t = setTimeout(() => {
        setDesiredRole("instructor");
        setDisplayName("");
        setMessage("");
        setSubmitting(false);
        setError(null);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!workspace) return null;

  async function handleSubmit() {
    if (!workspace) return;
    setSubmitting(true);
    setError(null);
    const result = await requestWorkspaceAccess(workspace.workspaceId, {
      desiredRole,
      displayName: displayName.trim() || null,
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success(`${workspace.name} 참여 요청을 보냈습니다.`);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader
        title={`${workspace.name} 참여 요청`}
        description="대표 운영자가 수락하면 즉시 멤버로 활성화됩니다."
      />
      <DialogBody>
        <div className="space-y-1.5">
          <Label htmlFor="request-role">희망 역할</Label>
          <Select
            id="request-role"
            value={desiredRole}
            onChange={(e) => setDesiredRole(e.target.value as DesiredRole)}
          >
            <option value="instructor">강사</option>
            <option value="group_admin">그룹 운영자</option>
          </Select>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            최종 역할은 운영자가 수락 시 확정합니다.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="request-name">이름 (선택)</Label>
          <Input
            id="request-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="예: 김강사"
            maxLength={80}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="request-message">메시지 (선택, 500자)</Label>
          <Textarea
            id="request-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="간단한 자기소개나 참여 사유를 적어 주세요."
            maxLength={500}
            rows={4}
          />
        </div>

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
          {submitting ? "요청 중..." : "요청 보내기"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
