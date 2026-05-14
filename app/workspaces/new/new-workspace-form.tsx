"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createWorkspaceAction } from "@/services/workspaces";

const TIMEZONE_OPTIONS = [
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "UTC",
] as const;

export function NewWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState<string>("Asia/Seoul");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    startTransition(async () => {
      const result = await createWorkspaceAction({
        name: name.trim(),
        timezone,
      });

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      toast.success("워크스페이스를 만들었어요.");
      router.replace(`/workspaces/${result.data.workspaceId}/home`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="ws-name"
          className="block text-sm font-medium text-[var(--color-foreground)]"
        >
          워크스페이스 이름
        </label>
        <input
          id="ws-name"
          type="text"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="예: 두레 교육"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20"
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="ws-timezone"
          className="block text-sm font-medium text-[var(--color-foreground)]"
        >
          기준 시간대
        </label>
        <select
          id="ws-timezone"
          name="timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20"
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "만드는 중…" : "워크스페이스 만들기"}
      </button>
    </form>
  );
}
