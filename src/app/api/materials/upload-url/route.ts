import { NextResponse, type NextRequest } from "next/server";

import { prepareMaterialUpload } from "@/services/materials";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_FAILED", message: "JSON 본문이 필요합니다." } },
      { status: 400 },
    );
  }

  const result = await prepareMaterialUpload(body as Parameters<typeof prepareMaterialUpload>[0]);
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
    case "UPLOAD_POLICY_VIOLATION":
      return 400;
    default:
      return 500;
  }
}