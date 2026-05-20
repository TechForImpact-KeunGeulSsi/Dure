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
        <fieldset className="space-y-2">
          <legend className="block text-xs font-semibold text-white/80">
            시작 역할
          </legend>
          <div className="grid gap-2">
            {ROLE_OPTIONS.map((option) => {
              const checked = preferredRole === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition ${
                    checked
                      ? "border-white bg-white text-[var(--color-foreground)]"
                      : "border-white/30 bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  <input
                    type="radio"
                    name="preferredRole"
                    value={option.value}
                    checked={checked}
                    onChange={() => setPreferredRole(option.value)}
                    className="mt-1 size-3.5 accent-[var(--color-primary)]"
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
