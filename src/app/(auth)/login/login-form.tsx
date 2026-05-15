"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  next: string;
};

type Mode = "password" | "magic_link";

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [magicSent, setMagicSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("이메일을 입력해 주세요.");
      return;
    }

    if (mode === "password") {
      if (!password) {
        toast.error("비밀번호를 입력해 주세요.");
        return;
      }
      startTransition(async () => {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          toast.error(translateAuthError(error.message));
          return;
        }
        router.replace(next);
        router.refresh();
      });
      return;
    }

    // mode === "magic_link"
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { emailRedirectTo },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setMagicSent(true);
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-bold tracking-tight text-white">
        {mode === "password" ? "로그인" : "매직 링크 로그인"}
      </h1>

      {magicSent ? (
        <div className="rounded-[var(--radius-md)] bg-white/10 px-4 py-6 text-center text-sm text-white">
          <p className="font-medium">{email}로 로그인 링크를 보냈어요.</p>
          <p className="mt-1 text-white/70">받은 메일의 링크를 눌러 로그인하세요.</p>
          <button
            type="button"
            className="mt-4 text-xs font-medium text-white underline"
            onClick={() => {
              setMagicSent(false);
              setMode("password");
            }}
          >
            비밀번호로 로그인
          </button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <UnderlineField
            id="login-email"
            label="이메일"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {mode === "password" && (
            <UnderlineField
              id="login-password"
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          )}

          {mode === "password" && (
            <div className="flex items-center justify-between text-xs text-white/90">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(event) => setKeepSignedIn(event.target.checked)}
                  className="size-3.5 accent-white"
                />
                <span>로그인 상태 유지</span>
              </label>
              <button
                type="button"
                className="font-semibold text-white"
                onClick={() => toast.info("비밀번호 찾기는 곧 제공될 예정입니다.")}
              >
                비밀번호 찾기
              </button>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={pending}
              className="mx-auto block min-w-[140px] rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--color-primary)] shadow-sm transition hover:bg-white/90 disabled:opacity-70"
            >
              {pending
                ? "처리 중…"
                : mode === "password"
                  ? "로그인"
                  : "링크 보내기"}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-xs text-white/80 underline"
              onClick={() => {
                setMode(mode === "password" ? "magic_link" : "password");
              }}
            >
              {mode === "password"
                ? "비밀번호 없이 로그인 (매직 링크)"
                : "비밀번호로 로그인"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type UnderlineFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
};

function UnderlineField({ id, label, className, ...rest }: UnderlineFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-white"
      >
        {label}
      </label>
      <input
        id={id}
        className={
          "w-full border-0 border-b border-white/40 bg-transparent py-2 text-white placeholder:text-white/40 outline-none focus:border-white" +
          (className ? ` ${className}` : "")
        }
        {...rest}
      />
    </div>
  );
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (lower.includes("email not confirmed")) {
    return "이메일 인증이 필요합니다. 수신함을 확인해 주세요.";
  }
  return message;
}
