'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteInstructor } from '@/services/workspace-members';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
};

export function InviteInstructorDialog({ open, onOpenChange, workspaceId }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setDisplayName('');
    setSubmitting(false);
    setError(null);
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
    setSubmitting(true);
    setError(null);

    const result = await inviteInstructor(workspaceId, {
      email: email.trim(),
      displayName: displayName.trim() || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    if (result.data.status === 'active') {
      toast.success('강사를 추가했습니다. 즉시 수업에 배정할 수 있습니다.');
    } else {
      toast.success('강사 초대를 등록했습니다. (초대 대기 상태)');
    }
    router.refresh();
    close();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogHeader
        title="강사 초대"
        description="이미 가입된 이메일이면 즉시 활성됩니다. 아니면 초대 대기로 등록되고, 추후 매직 링크를 통해 활성화됩니다."
      />
      <DialogBody>
        <div className="space-y-1.5">
          <Label htmlFor="instructor-email">이메일</Label>
          <Input
            id="instructor-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="instructor@example.com"
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="instructor-name">이름 (선택)</Label>
          <Input
            id="instructor-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="예: 김강사"
            maxLength={80}
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={close} disabled={submitting}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? '추가 중...' : '추가'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}