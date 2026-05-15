import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AcceptInviteClient } from "./accept-invite-client";

type AcceptInvitePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitePage({
  searchParams,
}: AcceptInvitePageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <MessageShell title="초대 토큰이 필요합니다">
        초대 메일에 포함된 링크로 다시 접속해 주세요.
      </MessageShell>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/accept-invite?token=${encodeURIComponent(token)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return <AcceptInviteClient token={token} />;
}

function MessageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--color-muted)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--color-border)] p-8 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
          {title}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          {children}
        </p>
      </div>
    </main>
  );
}
