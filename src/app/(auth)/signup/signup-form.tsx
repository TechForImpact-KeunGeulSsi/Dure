"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  KeyRound,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

import { signupAction } from "@/services/auth";
import { SignupInputSchema } from "@/lib/validators/workspace";
import type { SignupPreferredRole } from "@/lib/auth/signup-preferred-role";

type SignupFormProps = {
  next: string;
};

const ROLE_OPTIONS: Array<{
  value: SignupPreferredRole;
  label: string;
  description: string;
}> = [
  {
    value: "instructor",
    label: "강사",
    description: "기존 워크스페이스 참여 요청의 기본값이 강사로 설정됩니다.",
  },
  {
    value: "group_admin",
    label: "그룹 운영자",
    description: "기존 워크스페이스 참여 요청의 기본값이 그룹 운영자로 설정됩니다.",
  },
  {
    value: "owner_admin",
    label: "대표 운영자",
    description: "새 워크스페이스 만들기 흐름에 맞춰 안내됩니다.",
  },
];

export function SignupForm({ next }: SignupFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [preferredRole, setPreferredRole] =
    useState<SignupPreferredRole>("instructor");
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
      preferredRole,
      termsAccepted,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
      return;
    }

    startTransition(async () => {
      const result = await signupAction({
        ...parsed.data,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("환영합니다. 계정이 만들어졌어요.");
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div className="relative translate-y-0 space-y-6 rounded-2xl border border-white/15 bg-blue-950/50 p-6 opacity-100 shadow-2xl shadow-black/35 backdrop-blur-xl transition-all delay-150 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] starting:translate-y-4 starting:opacity-0 motion-reduce:transition-none motion-reduce:delay-0 motion-reduce:starting:translate-y-0 motion-reduce:starting:opacity-100">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100/80">
          DURE
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white drop-shadow-[0_0_28px_rgba(34,211,238,0.3)]">
          회원가입
        </h1>
      </div>
      <form className="space-y-5" onSubmit={handleSubmit}>
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
        <fieldset className="space-y-3">
          <legend className="block text-xs font-bold uppercase tracking-wider text-cyan-50/90">
            시작 역할
          </legend>
          <div className="grid gap-2.5">
            {ROLE_OPTIONS.map((option) => {
              const checked = preferredRole === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-sm transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] ${
                    checked
                      ? "border-cyan-400/80 bg-gradient-to-r from-white/95 to-cyan-50/95 text-slate-900 shadow-[0_0_24px_rgba(34,211,238,0.35)]"
                      : "border-white/15 bg-slate-900/40 text-white shadow-inner shadow-black/20 hover:border-cyan-400/40 hover:shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="preferredRole"
                    value={option.value}
                    checked={checked}
                    onChange={() => setPreferredRole(option.value)}
                    className="mt-1 size-4 accent-cyan-500"
                  />
                  <span className="flex gap-2">
                    <RoleIcon role={option.value} checked={checked} />
                    <span>
                      <span className="block font-semibold">{option.label}</span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          checked
                            ? "text-[var(--color-muted-foreground)]"
                            : "text-white/75"
                        }`}
                      >
                        {option.description}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="flex items-center gap-2.5 text-sm text-white/90">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="size-4 accent-cyan-400"
            required
          />
          <span>약관 및 개인정보 처리방침에 동의합니다.</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-4 text-lg font-bold tracking-wide text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:from-cyan-300 hover:to-blue-500 hover:shadow-[0_0_28px_rgba(34,211,238,0.55)] active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] disabled:active:scale-100"
        >
          {pending ? "계정 만드는 중…" : "계정 만들기"}
        </button>
      </form>
    </div>
  );
}

function RoleIcon({
  role,
  checked,
}: {
  role: SignupPreferredRole;
  checked: boolean;
}) {
  const className = `mt-0.5 size-4 shrink-0 ${
    checked ? "text-[var(--color-primary)]" : "text-white/80"
  }`;
  if (role === "owner_admin") return <ShieldCheck className={className} />;
  if (role === "group_admin") {
    return <BriefcaseBusiness className={className} />;
  }
  return <User className={className} />;
}

type PillFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: React.ReactNode;
};

function PillField({ id, label, icon, className, ...rest }: PillFieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-xs font-bold uppercase tracking-wider text-cyan-50/90"
      >
        {label}
      </label>
      <div className="flex h-12 items-center gap-3 rounded-xl border border-white/15 bg-slate-900/40 px-4 text-white shadow-inner shadow-black/20 transition-all duration-200 ease-out hover:border-white/25 focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.2)]">
        <span className="shrink-0 text-cyan-100/80">{icon}</span>
        <input
          id={id}
          className={
            "h-full w-full border-0 bg-transparent text-base text-white outline-none placeholder:text-white/45" +
            (className ? ` ${className}` : "")
          }
          {...rest}
        />
      </div>
    </div>
  );
}
