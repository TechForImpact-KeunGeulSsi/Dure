import * as React from "react";

import { cn } from "@/lib/utils/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 text-sm outline-none placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20 disabled:bg-[var(--color-muted)] disabled:opacity-70",
          className,
        )}
        {...rest}
      />
    );
  },
);
