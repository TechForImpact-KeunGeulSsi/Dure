import { AlertCircle, Bot, CalendarDays, ShieldCheck } from "lucide-react";

import type { AdminCopilotBriefing as AdminCopilotBriefingData } from "@/services/admin-copilot-logic";

import { AdminCopilotTaskCard } from "./admin-copilot-task-card";

type AdminCopilotBriefingProps = {
  workspaceId: string;
  briefing: AdminCopilotBriefingData | null;
  errorMessage?: string;
};

export function AdminCopilotBriefing({
  workspaceId,
  briefing,
  errorMessage,
}: AdminCopilotBriefingProps) {
  if (errorMessage) {
    return (
      <section className="mb-8 rounded-2xl border border-rose-100 bg-rose-50/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
          <div>
            <h2 className="text-sm font-bold text-rose-900">운영 브리핑을 불러오지 못했습니다</h2>
            <p className="mt-1 text-sm text-rose-700">{errorMessage}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!briefing) return null;

  const metrics = [
    { label: "앞으로 7일 회차", value: briefing.summary.upcomingSessionCount },
    { label: "출석 위험", value: briefing.summary.attendanceRiskParticipantCount },
    { label: "확인 미정 자료", value: briefing.summary.pendingMaterialCount },
    { label: "종료 확인 수업", value: briefing.summary.completionCandidateCount },
    { label: "새 피드백", value: briefing.summary.newFeedbackCount },
  ];

  return (
    <section
      aria-labelledby="admin-copilot-title"
      className="mb-8 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-gray-100 bg-blue-50/50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="admin-copilot-title" className="text-lg font-bold text-gray-950">
                운영 브리핑
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <ShieldCheck className="h-3 w-3" />
                사람 승인 필요
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              운영 데이터에서 확인이 필요한 항목을 규칙 기반으로 정리했습니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 sm:justify-end">
          <CalendarDays className="h-4 w-4 text-gray-400" />
          <span>
            {formatDate(briefing.window.recentFrom)} – {formatDate(briefing.window.upcomingUntil)}
          </span>
          <span className="text-gray-300">·</span>
          <span>{briefing.window.timezone}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-gray-100 bg-gray-100 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white px-5 py-4">
            <p className="text-xs font-medium text-gray-500">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-gray-950">
              {metric.value}
              <span className="ml-0.5 text-sm font-medium text-gray-400">건</span>
            </p>
          </div>
        ))}
      </div>

      <div className="px-5 pb-2 pt-5 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">우선순위 업무</h3>
            <p className="mt-1 text-xs text-gray-500">
              최근 7일 회차 {briefing.summary.recentSessionCount}건을 포함해 판단했습니다.
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-400">
            총 {briefing.tasks.length}건
          </span>
        </div>
      </div>

      {briefing.tasks.length > 0 ? (
        <div className="px-0 pb-2">
          {briefing.tasks.map((task) => (
            <AdminCopilotTaskCard key={task.id} workspaceId={workspaceId} task={task} />
          ))}
        </div>
      ) : (
        <div className="mx-5 mb-5 mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center sm:mx-6">
          <p className="text-sm font-semibold text-gray-800">지금 우선 확인할 업무가 없습니다.</p>
          <p className="mt-1 text-xs text-gray-500">
            자료, 출석, 피드백, 수업 상태를 계속 확인합니다.
          </p>
        </div>
      )}

      <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-xs leading-5 text-gray-500 sm:px-6">
        추천을 읽는 것만으로는 변경되지 않습니다. 자료 검토는 대표 운영자의 명시적 승인 후 처리됩니다.
      </div>
    </section>
  );
}

function formatDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}
