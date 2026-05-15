import * as React from "react";

import { cn } from "@/lib/utils/cn";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const TONE: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border border-[var(--color-border)]",
  primary:
    "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger: "bg-rose-50 text-rose-700 border border-rose-200",
};

export function Badge({ className, tone = "neutral", ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}
