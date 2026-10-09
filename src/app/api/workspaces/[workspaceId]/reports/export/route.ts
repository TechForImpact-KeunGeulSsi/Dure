import { NextResponse, type NextRequest } from "next/server";

import { type UUID } from "@/lib/api/types";
import { buildXlsx } from "@/lib/export/xlsx";
import {
  parseReportQuery,
  reportPeriod,
  reportPeriodLabel,
  todayInTimezone,
} from "@/lib/reports/report-query";
import { getParticipationReport } from "@/services/participation-report";
import {
  buildSubmissionSheets,
  type SubmissionOptions,
} from "@/services/report-export-logic";
import { getWorkspaceContext } from "@/services/workspaces";

type RouteParams = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { workspaceId } = await params;
  const search = request.nextUrl.searchParams;

  const context = await getWorkspaceContext(workspaceId);
  if (!context.ok) {
    return NextResponse.json(context, { status: statusForCode(context.error.code) });
  }
  const timezone = context.data.workspace.timezone;
  const today = todayInTimezone(timezone);
  const query = parseReportQuery(Object.fromEntries(search.entries()), today);
  const period = reportPeriod(query);

  const result = await getParticipationReport({
    workspaceId: workspaceId as UUID,
    startDate: period.startDate,
    endDate: period.endDate,
    today,
    courseIds: query.courseId ? [query.courseId] : undefined,
    gender: query.gender ?? undefined,
    hasDisability: query.disability ? query.disability === "yes" : undefined,
    ageBand: query.ageBand ?? undefined,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: statusForCode(result.error.code) });
  }

  const fields = new Set((search.get("fields") ?? "gender,age,disability").split(","));
  const options: SubmissionOptions = {
    nameMode: search.get("name") === "none" ? "none" : "masked",
    includeGender: fields.has("gender"),
    includeAgeBand: fields.has("age"),
    includeDisability: fields.has("disability"),
  };
  const periodLabel = reportPeriodLabel(query);
  const generatedAt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const workbook = buildXlsx(
    buildSubmissionSheets({
      report: result.data,
      courseNames: new Map(result.data.courseOptions.map((course) => [course.id, course.name])),
      participantNames: new Map(
        result.data.participants.map((participant) => [participant.id, participant.name]),
      ),
      periodLabel,
      missingRecordCount: result.data.missingRecordCount,
      generatedAt,
      options,
    }),
  );

  const fileName = `참여실적_${periodLabel.replace(/\s+/g, "_")}.xlsx`;
  return new NextResponse(Buffer.from(workbook), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

function statusForCode(code: string): number {
  switch (code) {
    case "AUTH_REQUIRED":
      return 401;
    case "WORKSPACE_ACCESS_DENIED":
    case "ROLE_FORBIDDEN":
    case "SCOPE_FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_FAILED":
      return 400;
    default:
      return 500;
  }
}
