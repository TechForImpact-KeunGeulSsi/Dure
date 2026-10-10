import assert from "node:assert/strict";
import test from "node:test";

import { toggleAllCourseIds } from "../src/lib/courses/course-filter.ts";

test("전체 수업이 선택된 상태에서 다시 누르면 모든 선택을 해제한다", () => {
  assert.deepEqual(
    toggleAllCourseIds(["fitness", "art", "music"], ["fitness", "art", "music"]),
    [],
  );
});

test("일부 또는 아무 수업도 선택되지 않았으면 전체 수업을 선택한다", () => {
  const allCourseIds = ["fitness", "art", "music"];

  assert.deepEqual(toggleAllCourseIds(["fitness"], allCourseIds), allCourseIds);
  assert.deepEqual(toggleAllCourseIds([], allCourseIds), allCourseIds);
});
