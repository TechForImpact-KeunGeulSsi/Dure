import { NextResponse, type NextRequest } from "next/server";

import { getMaterialDownloadUrl } from "@/services/materials";

type RouteParams = {
  params: Promise<{ materialId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { materialId } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "VALIDATION_FAILED", message: "workspaceId 쿼리 파라미터가 필요합니다." },
      },
      { status: 400 },
    );
  }

  const result = await getMaterialDownloadUrl(workspaceId, materialId);
  if (!result.ok) {
    return NextResponse.json(result, { status: statusForCode(result.error.code) });
  }
  return NextResponse.json(result);
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
    case "CONFLICT":
      return 409;
    case "VALIDATION_FAILED":
      return 400;
    default:
      return 500;
  }
}