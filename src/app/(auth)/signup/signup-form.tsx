"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Mail, User } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SignupInputSchema } from "@/lib/validators/workspace";

type SignupFormProps = {
  next: string;
};

export function SignupForm({ next }: SignupFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsed = SignupInputSchema.safeParse({
      displayName,
      email,
      password,
      passwordConfirm,
      termsAccepted,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { display_name: parsed.data.displayName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        toast.error(translateSignupError(error.message));
        return;
      }
      toast.success("환영합니다. 계정이 만들어졌어요.");
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-wide text-white/80">DURE</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
          회원가입
        </h1>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <PillField
          id="signup-name"
          label="이름"
          icon={<User className="size-4" />}
          placeholder="담당자 이름"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
        <PillField
          id="signup-email"
          label="이메일"
          type="email"
          icon={<Mail className="size-4" />}
          placeholder="name@dure.edu"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <PillField
          id="signup-password"
          label="비밀번호"
          type="password"
          icon={<KeyRound className="size-4" />}
          placeholder="8자 이상"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <PillField
          id="signup-password-confirm"
          label="비밀번호 확인"
          type="password"
          icon={<KeyRound className="size-4" />}
          placeholder="다시 입력"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          required
        />
        <label className="flex items-center gap-2 text-xs text-white/90">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="size-3.5 accent-white"
            required
          />
          <span>약관 및 개인정보 처리방침에 동의합니다.</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[var(--radius-md)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-white/90 disabled:opacity-70"
        >
          {pending ? "계정 만드는 중…" : "계정 만들기"}
        </button>
      </form>
    </div>
  );
}

type PillFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: React.ReactNode;
};

function PillField({ id, label, icon, className, ...rest }: PillFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-white/80">
        {label}
      </label>
      <div className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-white pl-3 pr-3 text-[var(--color-foreground)]">
        <span className="text-[var(--color-muted-foreground)]">{icon}</span>
        <input
          id={id}
          className={
            "h-full w-full border-0 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted-foreground)]" +
            (className ? ` ${className}` : "")
          }
          {...rest}
        />
      </div>
    </div>
  );
}

function translateSignupError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "이미 가입된 이메일입니다. 로그인을 시도해 주세요.";
  }
  if (lower.includes("password should be")) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  return message;
}
