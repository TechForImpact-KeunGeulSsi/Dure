"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("이메일을 입력해 주세요.");
      return;
    }
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
  }

  return (
    <div className="relative translate-y-0 space-y-7 rounded-2xl border border-white/80 bg-white/70 p-7 opacity-100 shadow-xl shadow-blue-200/45 backdrop-blur-xl transition-all delay-150 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] starting:translate-y-4 starting:opacity-0 motion-reduce:transition-none motion-reduce:delay-0 motion-reduce:starting:translate-y-0 motion-reduce:starting:opacity-100">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-800">
        로그인
      </h1>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <UnderlineField
          id="login-email"
          label="이메일"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <UnderlineField
          id="login-password"
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <div className="flex items-center justify-between pt-1 text-sm font-medium text-slate-700">
          <label className="inline-flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(event) => setKeepSignedIn(event.target.checked)}
              className="size-4 accent-blue-600"
            />
            <span>로그인 상태 유지</span>
          </label>
          <button
            type="button"
            className="font-semibold text-blue-600 transition-colors hover:text-blue-700"
            onClick={() => toast.info("비밀번호 찾기는 곧 제공될 예정입니다.")}
          >
            비밀번호 찾기
          </button>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-lg font-semibold tracking-wide text-white shadow-lg shadow-blue-500/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-600 hover:shadow-xl hover:shadow-blue-500/30 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-lg disabled:active:scale-100"
          >
            {pending ? "처리 중…" : "로그인"}
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            className="text-sm text-slate-600 underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
            onClick={() => router.push("/")}
          >
            로그인 없이 둘러보기
          </button>
        </div>
      </form>
    </div>
  );
}

type UnderlineFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
};

function UnderlineField({ id, label, className, ...rest }: UnderlineFieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-widest text-slate-600"
      >
        {label}
      </label>
      <input
        id={id}
        className={
          "w-full rounded-lg border border-blue-100 border-b-2 border-b-blue-200 bg-blue-50/60 px-4 py-3.5 text-base text-slate-800 shadow-inner shadow-blue-100/50 placeholder:text-slate-400 outline-none transition-all duration-200 ease-out hover:border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 focus:shadow-[0_0_16px_rgba(37,99,235,0.18)]" +
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
