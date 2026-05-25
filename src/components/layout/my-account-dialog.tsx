"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
};

/**
 * 사용자 본인 계정 정보(이메일/비밀번호) 수정 다이얼로그.
 * Supabase Auth의 updateUser API를 사용해 클라이언트 측에서 직접 변경한다.
 * - 이메일 변경 시: Supabase가 새 이메일로 확인 메일을 발송하며, 확인 전까지는 기존 이메일이 유지된다.
 * - 비밀번호 변경 시: 8자 이상 권장(가입 시 검증 규칙과 동일).
 */
export function MyAccountDialog({ open, onOpenChange, currentEmail }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(currentEmail);
      setPassword("");
      setPasswordConfirm("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, currentEmail]);

  const close = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setError(null);

    const trimmedEmail = email.trim();
    const emailChanged = trimmedEmail !== currentEmail;
    const passwordChanged = password.length > 0;

    if (!emailChanged && !passwordChanged) {
      toast.info("변경된 내용이 없습니다.");
      return;
    }

    if (emailChanged) {
      if (!trimmedEmail) {
        setError("이메일을 입력해 주세요.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError("올바른 이메일 형식이 아닙니다.");
        return;
      }
    }

    if (passwordChanged) {
      if (password.length < 8) {
        setError("비밀번호는 8자 이상이어야 합니다.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("비밀번호 확인이 일치하지 않습니다.");
        return;
      }
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const payload: { email?: string; password?: string } = {};
    if (emailChanged) payload.email = trimmedEmail;
    if (passwordChanged) payload.password = password;

    const { error: updateError } = await supabase.auth.updateUser(payload);
    setSubmitting(false);

    if (updateError) {
      setError(translateAuthUpdateError(updateError.message));
      return;
    }

    if (emailChanged) {
      toast.success(
        "이메일 변경 확인 메일을 발송했습니다. 새 이메일에서 인증을 완료해 주세요.",
      );
    } else {
      toast.success("비밀번호를 변경했습니다.");
    }

    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogHeader
        title="내 정보 수정"
        description="이메일(아이디)과 비밀번호를 변경할 수 있습니다."
      />
      <DialogBody>
        <div className="space-y-1.5">
          <Label htmlFor="account-email">이메일 (아이디)</Label>
          <Input
            id="account-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            autoComplete="off"
          />
          <p className="text-xs text-[var(--color-muted-foreground)]">
            이메일을 변경하면 새 주소로 확인 메일이 발송됩니다.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="account-password">새 비밀번호 (변경할 때만 입력)</Label>
          <Input
            id="account-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="account-password-confirm">새 비밀번호 확인</Label>
          <Input
            id="account-password-confirm"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="다시 한 번 입력"
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={close} disabled={submitting}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function translateAuthUpdateError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("password should be") || lower.includes("password")) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  if (lower.includes("already") || lower.includes("registered")) {
    return "이미 사용 중인 이메일입니다.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return message;
}