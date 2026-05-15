import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";

import { SignupForm } from "./signup-form";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(next ?? "/workspaces");
  }

  return (
    <AuthShell
      footer={
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">
            이미 계정이 있나요?
          </p>
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="block w-full rounded-[var(--radius-md)] border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
          >
            로그인
          </Link>
        </div>
      }
      formCard={<SignupForm next={next ?? "/workspaces"} />}
    />
  );
}
