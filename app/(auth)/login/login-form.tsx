"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("이메일을 입력해 주세요.");
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo },
    });

    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
    toast.success("로그인 링크를 이메일로 보냈어요.");
  }

  if (sent) {
    return (
      <div className="text-center text-sm text-[var(--color-muted-foreground)]">
        <p className="mb-2 text-[var(--color-foreground)] font-medium">
          {email}로 로그인 링크를 보냈어요.
        </p>
        <p>받은 메일의 링크를 눌러 로그인하세요.</p>
        <button
          type="button"
          className="mt-6 text-[var(--color-primary)] underline"
          onClick={() => setSent(false)}
        >
          다른 이메일 사용
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[var(--color-foreground)]"
        >
          이메일
        </label>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "전송 중…" : "로그인 링크 받기"}
      </button>
    </form>
  );
}
