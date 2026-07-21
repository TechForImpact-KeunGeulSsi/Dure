import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleDot,
} from "lucide-react";
import Link from "next/link";

import type {
  AdminCopilotTask,
  AdminCopilotTaskPriority,
} from "@/services/admin-copilot-logic";

const PRIORITY: Record<
  AdminCopilotTaskPriority,
  { label: string; className: string; icon: typeof AlertTriangle }
> = {
  high: {
    label: "우선 확인",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
    icon: AlertTriangle,
  },
  medium: {
    label: "확인 필요",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: CircleDot,
  },
  low: {
    label: "검토",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: CheckCircle2,
  },
};

export function AdminCopilotTaskCard({ task }: { task: AdminCopilotTask }) {
  const priority = PRIORITY[task.priority];
  const PriorityIcon = priority.icon;

  return (
    <article className="border-t border-gray-100 px-5 py-5 first:border-t-0 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${priority.className}`}
            >
              <PriorityIcon className="h-3.5 w-3.5" />
              {priority.label}
            </span>
            <span className="text-xs font-medium text-gray-400">
              {taskTypeLabel(task.type)}
            </span>
          </div>

          <h3 className="mt-3 text-base font-bold text-gray-900">{task.title}</h3>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-gray-600">
            {task.summary}
          </p>
          <p className="mt-2 text-sm font-medium text-gray-800">
            {task.recommendedManualAction}
          </p>
        </div>

        <Link
          href={task.relatedHref}
          className="inline-flex h-9 flex-shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          관련 화면
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <details className="group mt-4">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-800 [&::-webkit-details-marker]:hidden">
          판단 근거 {task.evidence.length}개
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {task.evidence.map((evidence, index) => (
            <li
              key={`${evidence.entityType}:${evidence.entityId}:${index}`}
              className="rounded-lg bg-gray-50 px-3.5 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {evidenceTypeLabel(evidence.entityType)}
                </span>
                <span className="truncate text-xs font-semibold text-gray-800">
                  {evidence.label}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {evidence.reason}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function taskTypeLabel(type: AdminCopilotTask["type"]): string {
  const labels: Record<AdminCopilotTask["type"], string> = {
    attendance_risk_participant: "출석",
    pending_material_review: "자료",
    course_completion_candidate: "수업 상태",
    new_course_feedback: "피드백",
  };
  return labels[type];
}

function evidenceTypeLabel(type: AdminCopilotTask["evidence"][number]["entityType"]): string {
  const labels: Record<
    AdminCopilotTask["evidence"][number]["entityType"],
    string
  > = {
    course: "수업",
    course_session: "회차",
    participant: "참여자",
    material: "자료",
    attendance_record: "출석 기록",
    course_feedback: "피드백",
  };
  return labels[type];
}
