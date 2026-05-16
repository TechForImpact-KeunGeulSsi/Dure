import Link from "next/link";
import { Building2, Home, ShieldCheck } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { OnboardingHeader } from "./onboarding-header";

import { NewWorkspaceForm } from "./new-workspace-form";

export default async function NewWorkspacePage() {
  const user = await requireUser();
  const displayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : null;

  return (
    <div className="min-h-screen bg-[#eaf2ff]">
      <OnboardingHeader email={user.email ?? "이메일 미설정"} role="운영자" />
      <main className="relative mx-auto max-w-5xl px-4 pt-8 pb-16">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 size-16 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] text-2xl font-bold">
            D
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            두레에서의 첫 걸음
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            워크스페이스를 새로 만들거나, 기존 워크스페이스에 참여해 수업 운영을 시작하세요.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1.7fr_1fr] md:items-start">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <NewWorkspaceForm defaultOwnerName={displayName} />
            <JoinExistingHint />
          </section>
          <aside className="rounded-[var(--radius-lg)] bg-white/70 border border-[var(--color-border)] p-6">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">
              시작 후 관리할 수 있어요
            </p>
            <ul className="mt-4 space-y-4">
              <FeatureRow
                icon={<Home className="size-4" />}
                title="그룹 관리"
                description="운영 단위와 참여자를 그룹별로 정리"
              />
              <FeatureRow
                icon={<Building2 className="size-4" />}
                title="수업 설정"
                description="그룹별 수업 개설과 회차 관리"
              />
              <FeatureRow
                icon={<ShieldCheck className="size-4" />}
                title="권한 설정"
                description="운영자와 강사를 초대해 협업"
              />
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--color-foreground)]">
          {title}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {description}
        </p>
      </div>
    </li>
  );
}

function JoinExistingHint() {
  return (
    <Link
      href="/workspaces/discover"
      className="mt-6 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-sm hover:border-[var(--color-primary)]"
    >
      <span className="font-medium text-[var(--color-foreground)]">
        기존 워크스페이스로 참여하기
      </span>
      <span className="text-xs text-[var(--color-primary)]">
        워크스페이스 둘러보기 →
      </span>
    </Link>
  );
}
