import * as React from 'react';

import { cn } from '@/lib/utils/cn';

export function Table({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...rest} />
    </div>
  );
}

export function THead({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('bg-[var(--color-muted)]/60 text-left', className)}
      {...rest}
    />
  );
}

export function TBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-[var(--color-border)]', className)} {...rest} />;
}

export function Tr({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn(className)} {...rest} />;
}

export function Th({
  className,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({
  className,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 align-middle text-sm text-gray-700', className)} {...rest} />
  );
}

export const TableHeader = THead;
export const TableBody = TBody;
export const TableRow = Tr;
export const TableHead = Th;
export const TableCell = Td;
