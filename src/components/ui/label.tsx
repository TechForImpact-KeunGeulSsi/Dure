import * as React from "react";

import { cn } from "@/lib/utils/cn";

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  function Label({ className, ...rest }, ref) {
    return (
      <label
        ref={ref}
        className={cn(
          "block text-sm font-medium text-[var(--color-foreground)]",
          className,
        )}
        {...rest}
      />
    );
  },
);
