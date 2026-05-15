"use client";

import { cn } from "@/lib/utils/cn";

// 0=Sun ~ 6=Sat (matches JS Date.getDay() and Postgres extract(dow ...))
const LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type WeekdayPickerProps = {
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
};

export function WeekdayPicker({ value, onChange, disabled }: WeekdayPickerProps) {
  const selected = new Set(value);
  function toggle(day: number) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange([...next].sort((a, b) => a - b));
  }
  return (
    <div className="flex gap-1.5">
      {LABELS.map((label, day) => {
        const active = selected.has(day);
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => toggle(day)}
            className={cn(
              "size-9 rounded-full text-sm font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "bg-[var(--color-muted)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]",
            )}
            aria-pressed={active}
            aria-label={`${label}요일`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
