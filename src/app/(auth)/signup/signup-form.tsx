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
    <div className="relative translate-y-0 space-y-6 rounded-2xl border border-white/80 bg-white/70 p-7 opacity-100 shadow-xl shadow-blue-200/45 backdrop-blur-xl transition-all delay-150 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] starting:translate-y-4 starting:opacity-0 motion-reduce:transition-none motion-reduce:delay-0 motion-reduce:starting:translate-y-0 motion-reduce:starting:opacity-100">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-600">
          DURE
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-800">
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
        <fieldset className="space-y-3">
          <legend className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
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
                      ? "border-blue-500 bg-gradient-to-r from-blue-50 to-white text-slate-800 shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                      : "border-blue-100 bg-blue-50/50 text-slate-800 shadow-inner shadow-blue-100/40 hover:border-blue-300 hover:shadow-[0_0_12px_rgba(37,99,235,0.12)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="preferredRole"
                    value={option.value}
                    checked={checked}
                    onChange={() => setPreferredRole(option.value)}
                    className="mt-1 size-4 accent-blue-600"
                  />
                  <span className="flex gap-2">
                    <RoleIcon role={option.value} checked={checked} />
                    <span>
                      <span className="block font-semibold">{option.label}</span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          checked
                            ? "text-[var(--color-muted-foreground)]"
                            : "text-slate-600"
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
        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="size-4 accent-blue-600"
            required
          />
          <span>약관 및 개인정보 처리방침에 동의합니다.</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-lg font-semibold tracking-wide text-white shadow-lg shadow-blue-500/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-600 hover:shadow-xl hover:shadow-blue-500/30 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-lg disabled:active:scale-100"
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
    checked ? "text-blue-600" : "text-slate-500"
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
        className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
      >
        {label}
      </label>
      <div className="flex h-12 items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 text-slate-800 shadow-inner shadow-blue-100/50 transition-all duration-200 ease-out hover:border-blue-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25 focus-within:shadow-[0_0_16px_rgba(37,99,235,0.18)]">
        <span className="shrink-0 text-blue-600">{icon}</span>
        <input
          id={id}
          className={
            "h-full w-full border-0 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400" +
            (className ? ` ${className}` : "")
          }
          {...rest}
        />
      </div>
    </div>
  );
}
