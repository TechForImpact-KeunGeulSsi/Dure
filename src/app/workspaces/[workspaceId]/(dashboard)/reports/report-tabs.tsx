import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

export function ReportTabs({
  workspaceId,
  active,
}: {
  workspaceId: string;
  active: 'participation' | 'low-attendance';
}) {
  const base = `/workspaces/${workspaceId}/reports`;
  const tabs = [
    { key: 'participation', href: base, label: '참여 실적' },
    { key: 'low-attendance', href: `${base}/low-attendance`, label: '저출석자' },
  ] as const;
  return (
    <nav aria-label="보고서 종류" className="flex gap-1 border-b border-[var(--color-border)] print:hidden">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            active === tab.key
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
