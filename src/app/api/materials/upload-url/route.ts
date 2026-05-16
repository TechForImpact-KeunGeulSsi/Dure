import { NextResponse } from "next/server";

/**
 * 사용 중단됨.
 *
 * 단계 6의 자료 업로드 흐름은 클라이언트 PUT을 제거하고,
 * server action `uploadMaterial(workspaceId, courseId, formData)`로 통합됨.
 * 이 엔드포인트는 더 이상 사용되지 않으며, 호환성을 위해 410 응답만 반환한다.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "DEPRECATED",
        message:
          "이 엔드포인트는 사용 중단되었습니다. server action uploadMaterial을 사용하세요.",
      },
    },
    { status: 410 },
  );
}