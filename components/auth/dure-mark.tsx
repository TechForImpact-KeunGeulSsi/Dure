import * as React from "react";

import { cn } from "@/lib/utils/cn";

type DureMarkProps = {
  className?: string;
};

/**
 * Decorative DURE brand mark — a stylized pair of figures cradling a sprout.
 * Inspired by the illustration on Figma frame 27:2. Kept as an inline SVG so
 * the mark scales to its container without an external asset pipeline.
 */
export function DureMark({ className }: DureMarkProps) {
  return (
    <svg
      role="img"
      aria-label="DURE 마크"
      viewBox="0 0 160 160"
      className={cn("text-[var(--color-primary)]", className)}
    >
      <circle cx="48" cy="64" r="30" fill="currentColor" />
      <circle cx="112" cy="64" r="30" fill="currentColor" />
      <circle cx="80" cy="92" r="42" fill="currentColor" />
      <circle cx="116" cy="40" r="10" fill="#60a5fa" />
      <path
        d="M80 80 Q72 60 60 56 Q72 72 76 88"
        stroke="#86efac"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M80 80 Q88 60 100 56 Q88 72 84 88"
        stroke="#86efac"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M80 82 L80 110"
        stroke="#34d399"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
