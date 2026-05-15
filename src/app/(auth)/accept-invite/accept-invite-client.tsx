"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AcceptInviteClientProps = {
  token: string;
};

type State =
  | { kind: "pending" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function AcceptInviteClient({ token }: AcceptInviteClientProps) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "pending" });
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/invites/${encodeURIComponent(token)}/accept`,
          { method: "POST" },
        );
        const body = (await res.json()) as
          | { ok: true; data: { workspaceId: string } }
          | { ok: false; error: { code: string; message: string } };

        if (body.ok) {
          setState({ kind: "success" });
          router.replace(`/workspaces/${body.data.workspaceId}/home`);
          router.refresh();
          return;
        }

        setState({ kind: "error", message: body.error.message });
      } catch (err) {
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : "초대를 처리하지 못했습니다.",
        });
      }
    })();
  }, [router, token]);

  return (
    <main className="min-h-screen bg-[var(--color-muted)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--color-border)] p-8 text-center">
        {state.kind === "pending" && (
          <>
            <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
              초대를 수락하는 중…
            </h1>
            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
              잠시만 기다려 주세요.
            </p>
          </>
        )}
        {state.kind === "success" && (
          <>
            <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
              초대를 수락했어요
            </h1>
            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
              곧 워크스페이스로 이동합니다.
            </p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
              초대를 처리하지 못했습니다
            </h1>
            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
              {state.message}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
