'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select } from '@/components/ui/select';
import { createInvite } from '@/services/invites';
import type { GroupSummary, WorkspaceRole } from '@/lib/api/types';

type InvitableRole = Extract<WorkspaceRole, 'owner_admin' | 'group_admin' | 'instructor'>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  groups: GroupSummary[];
};

type SuccessState = {
  inviteUrl: string;
  expiresAt: string;
  email: string;
};

export function InviteMemberDialog({ open, onOpenChange, workspaceId, groups }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<InvitableRole>('instructor');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setRole('instructor');
    setEmail('');
    setDisplayName('');
    setGroupIds([]);
    setSubmitting(false);
    setError(null);
    setSuccess(null);
    setCopied(false);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('이메일을 입력해 주세요.');
      return;
    }
    if (role === 'group_admin' && groupIds.length === 0) {
      setError('그룹 운영자는 1개 이상의 그룹을 선택해야 합니다.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createInvite(workspaceId, {
      email: email.trim(),
      displayName: displayName.trim() || null,
      role,
      groupIds: role === 'group_admin' ? groupIds : undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    toast.success('초대 메일을 발송했습니다. 받지 못했다면 아래 링크를 복사해 공유하세요.');
    setSuccess({
      inviteUrl: result.data.inviteUrl,
      expiresAt: result.data.expiresAt,
      email: email.trim(),
    });
    router.refresh();
  };

  const handleCopy = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
    }
  };

  const groupOptions = groups.map((g) => ({ id: g.id, label: g.name }));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogHeader
        title="멤버 초대"
        description={
          success
            ? '아래 링크를 직접 전달해도 됩니다. 7일간 유효합니다.'
            : '역할을 선택하고 이메일을 입력하면 매직 링크 초대 메일이 발송됩니다.'
        }
      />

      {success ? (
        <DialogBody>
          <div className="space-y-1">
            <p className="text-sm text-[var(--color-foreground)]">
              <span className="font-semibold">{success.email}</span> 으로 초대를 발송했습니다.
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              로컬 개발 환경에서는 Inbucket(http://127.0.0.1:54324)에서 메일을 확인하세요.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-url">초대 링크</Label>
            <div className="flex gap-2">
              <Input
                id="invite-url"
                value={success.inviteUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                aria-label="링크 복사"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogBody>
      ) : (
        <DialogBody>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">역할</Label>
            <Select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as InvitableRole)}
            >
              <option value="instructor">강사</option>
              <option value="group_admin">그룹 운영자</option>
              <option value="owner_admin">대표 운영자</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">이메일</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-name">이름 (선택)</Label>
            <Input
              id="invite-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="예: 김운영"
              maxLength={80}
            />
          </div>

          {role === 'group_admin' && (
            <div className="space-y-1.5">
              <Label>접근 그룹</Label>
              <MultiSelect
                options={groupOptions}
                selectedIds={groupIds}
                onChange={setGroupIds}
                placeholder="그룹을 선택하세요"
              />
              <p className="text-xs text-[var(--color-muted-foreground)]">
                그룹 운영자는 선택한 그룹의 수업·참여자·자료에만 접근할 수 있습니다.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </DialogBody>
      )}

      <DialogFooter>
        {success ? (
          <Button onClick={close}>닫기</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={submitting}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '초대 중...' : '초대 보내기'}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
