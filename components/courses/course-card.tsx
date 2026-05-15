import Link from "next/link";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import type { CourseListItem } from "@/lib/api/types";

const DEFAULT_COLOR = "#2563eb";

type CourseCardProps = {
  course: CourseListItem;
  /**
   * Where the card should navigate to when clicked. Defaults to a coming-soon
   * placeholder (수업 상세는 Phase 5). Caller passes a custom href once detail
   * pages exist.
   */
  href?: string;
  className?: string;
};

export function CourseCard({ course, href, className }: CourseCardProps) {
  const subtitle = course.groups
    .map((group) => group.name)
    .slice(0, 2)
    .join(", ");
  const color = course.cardColor ?? DEFAULT_COLOR;

  const content = (
    <article
      className={cn(
        "flex h-full min-h-[18rem] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div
        className="relative px-5 pt-4 pb-6 text-white"
        style={{ backgroundColor: color }}
      >
        <p className="text-base font-bold leading-tight">{course.name}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-white/85">{subtitle}</p>
        )}
        <InstructorAvatar
          displayName={
            course.instructor?.displayName ?? course.instructor?.email ?? null
          }
        />
      </div>
      <div className="flex flex-1 flex-col justify-between px-5 py-4">
        <div>
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {course.instructor?.displayName ??
              course.instructor?.email ??
              "담당 강사 미지정"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {course.instructor ? "담당 강사" : "곧 강사를 배정해 주세요."}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)]">
          <Users className="size-4" />
          <span>{course.participantCount}명 참여자</span>
        </div>
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]/30 rounded-[var(--radius-lg)]">
        {content}
      </Link>
    );
  }
  return content;
}

function InstructorAvatar({ displayName }: { displayName: string | null }) {
  const initial = displayName?.trim().charAt(0).toUpperCase() ?? "M";
  return (
    <span className="absolute right-4 -bottom-5 flex size-10 items-center justify-center rounded-full border-2 border-white bg-[var(--color-foreground)] text-xs font-semibold text-white">
      {initial}
    </span>
  );
}
