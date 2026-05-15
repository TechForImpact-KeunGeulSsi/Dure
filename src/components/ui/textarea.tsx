import * as React from "react";

import { cn } from "@/lib/utils/cn";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 py-2 text-sm outline-none placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20 disabled:bg-[var(--color-muted)] disabled:opacity-70",
          className,
        )}
        {...rest}
      />
    );
  },
);
