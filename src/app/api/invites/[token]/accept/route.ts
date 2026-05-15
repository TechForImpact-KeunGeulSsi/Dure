import { NextResponse, type NextRequest } from "next/server";

import { acceptInvite } from "@/services/invites";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const result = await acceptInvite(token);

  if (!result.ok) {
    const status = statusForCode(result.error.code);
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}

function statusForCode(code: string): number {
  switch (code) {
    case "AUTH_REQUIRED":
      return 401;
    case "INVITE_EXPIRED":
      return 410;
    case "INVITE_ALREADY_ACCEPTED":
    case "CONFLICT":
      return 409;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_FAILED":
      return 400;
    default:
      return 500;
  }
}
