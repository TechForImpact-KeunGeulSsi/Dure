import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveAdminCopilotParticipantCourses,
  loadAllAdminCopilotRows,
} from "../src/services/admin-copilot-participant-projection.ts";

const baseInput = {
  courseGroups: [
    { course_id: "course-1", group_id: "group-1" },
    { course_id: "course-1", group_id: "group-2" },
  ],
  groups: [
    { id: "group-1", deleted_at: null },
    { id: "group-2", deleted_at: null },
  ],
  participantGroups: [
    { participant_id: "participant-1", group_id: "group-1", status: "active" },
  ],
  participants: [
    {
      id: "participant-1",
      status: "active",
      deleted_at: null,
    },
  ],
  participantCourses: [],
};

test("course_participants active 행 없이도 연결 그룹의 참여자를 수업 대상으로 파생한다", () => {
  assert.deepEqual(deriveAdminCopilotParticipantCourses(baseInput), [
    { course_id: "course-1", participant_id: "participant-1" },
  ]);
});

test("여러 연결 그룹에 속한 같은 참여자는 수업별 한 번만 반환한다", () => {
  assert.deepEqual(
    deriveAdminCopilotParticipantCourses({
      ...baseInput,
      participantGroups: [
        { participant_id: "participant-1", group_id: "group-1", status: "active" },
        { participant_id: "participant-1", group_id: "group-2", status: "active" },
      ],
    }),
    [{ course_id: "course-1", participant_id: "participant-1" }],
  );
});

test("명시 제외된 참여자는 그룹 관계가 활성이어도 수업 대상에서 제외한다", () => {
  assert.deepEqual(
    deriveAdminCopilotParticipantCourses({
      ...baseInput,
      participantCourses: [
        {
          course_id: "course-1",
          participant_id: "participant-1",
          status: "excluded",
        },
      ],
    }),
    [],
  );
});

test("제거된 그룹 관계와 삭제된 참여자는 대상에서 제외한다", () => {
  assert.deepEqual(
    deriveAdminCopilotParticipantCourses({
      ...baseInput,
      participantGroups: [
        { participant_id: "participant-1", group_id: "group-1", status: "removed" },
      ],
    }),
    [],
  );

  assert.deepEqual(
    deriveAdminCopilotParticipantCourses({
      ...baseInput,
      participants: [
        {
          id: "participant-1",
          status: "deleted",
          deleted_at: "2026-07-25T00:00:00Z",
        },
      ],
    }),
    [],
  );
});

test("소프트 삭제된 그룹의 참여자는 대상에서 제외한다", () => {
  assert.deepEqual(
    deriveAdminCopilotParticipantCourses({
      ...baseInput,
      groups: [
        { id: "group-1", deleted_at: "2026-07-25T00:00:00Z" },
        { id: "group-2", deleted_at: null },
      ],
    }),
    [],
  );
});

test("Supabase 최대 행 수를 넘는 projection row를 페이지 단위로 모두 로드한다", async () => {
  const source = Array.from({ length: 2_005 }, (_, index) => index);
  const requestedRanges = [];

  const result = await loadAllAdminCopilotRows((from, to) => {
    requestedRanges.push([from, to]);
    return Promise.resolve({ data: source.slice(from, to + 1), error: null });
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, source);
  assert.deepEqual(requestedRanges, [
    [0, 999],
    [1_000, 1_999],
    [2_000, 2_999],
  ]);
});

test("projection 페이지 조회 오류를 호출자에게 전달하고 추가 조회를 중단한다", async () => {
  let callCount = 0;
  const expectedError = { message: "projection query failed" };

  const result = await loadAllAdminCopilotRows(() => {
    callCount += 1;
    return Promise.resolve({ data: null, error: expectedError });
  });

  assert.equal(callCount, 1);
  assert.equal(result.error, expectedError);
  assert.deepEqual(result.data, []);
});
