import * as React from "react";

import { cn } from "@/lib/utils/cn";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 text-sm outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20 disabled:bg-[var(--color-muted)] disabled:opacity-70",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
