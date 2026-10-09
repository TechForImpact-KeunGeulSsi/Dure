import assert from "node:assert/strict";
import test from "node:test";

import {
  ageBandKey,
  ageBandLabel,
  buildParticipationReport,
  monthPeriod,
  quarterPeriod,
  yearPeriod,
} from "../src/services/participation-report-logic.ts";
import { buildMapoDashboardFixture } from "./mapo-dashboard-fixture.mjs";

// PR 통합 문서 7.3 예시: 1분기, 미술·체육 모두 월 4회
// A(미술) 1월 4·2월 4·3월 0 / B(미술·체육) 1월 6·2월 0·3월 4 / C(체육) 1월 1·2월 중단·3월 2
function buildQuarterExample() {
  const courses = [
    { id: "art", name: "미술" },
    { id: "fitness", name: "체육" },
  ];
  const sessions = [];
  for (const month of [1, 2, 3]) {
    for (const [index, day] of [5, 12, 19, 26].entries()) {
      sessions.push(session(`art-${month}-${index + 1}`, "art", `2026-${pad(month)}-${pad(day)}`));
      sessions.push(session(`fitness-${month}-${index + 1}`, "fitness", `2026-${pad(month)}-${pad(day + 1)}`));
    }
  }
  sessions.push({ ...session("art-cancelled", "art", "2026-02-09"), progressStatus: "cancelled" });

  const participants = [
    { id: "A", gender: "female", birthYear: 1990, hasDisability: true },
    { id: "B", gender: "male", birthYear: 2012, hasDisability: false },
    { id: "C", gender: "female", birthYear: 1961, hasDisability: true },
  ];

  const records = [];
  const mark = (participantId, courseId, month, sessionNos, status = "present") => {
    for (const no of [1, 2, 3, 4]) {
      records.push({
        sessionId: `${courseId}-${month}-${no}`,
        participantId,
        status: sessionNos.includes(no) ? status : "absent",
      });
    }
  };
  mark("A", "art", 1, [1, 2, 3, 4]);
  mark("A", "art", 2, [1, 2, 3, 4]);
  mark("A", "art", 3, []);
  mark("B", "art", 1, [1, 2, 3, 4]);
  mark("B", "fitness", 1, [1, 2]);
  mark("B", "art", 2, []);
  mark("B", "fitness", 2, []);
  mark("B", "art", 3, [1, 2]);
  mark("B", "fitness", 3, [3, 4]);
  mark("C", "fitness", 1, [2], "partial");
  mark("C", "fitness", 3, [1, 3]);
  // 휴강 회차에 남은 기록은 세지 않는다
  records.push({ sessionId: "art-cancelled", participantId: "A", status: "present" });

  return { courses, sessions, participants, records };

  function session(id, courseId, date) {
    return { id, courseId, date, rollupStatus: "included", progressStatus: "scheduled" };
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function report(data, period, filter) {
  return buildParticipationReport({ ...data, period, ageReferenceYear: 2026, filter });
}

test("월별 실인원을 더해도 분기 실인원이 되지 않는다", () => {
  const data = buildQuarterExample();
  const monthly = [1, 2, 3].map((month) => report(data, monthPeriod(2026, month)).total);

  assert.deepEqual(monthly.map((count) => count.uniqueParticipants), [3, 1, 2]);
  assert.deepEqual(monthly.map((count) => count.attendanceCount), [11, 4, 6]);

  const quarter = report(data, quarterPeriod(2026, 1)).total;
  assert.equal(quarter.uniqueParticipants, 3);
  assert.equal(quarter.attendanceCount, 21);
  // 연인원은 월별 합과 분기 값이 같아야 한다
  assert.equal(
    monthly.reduce((sum, count) => sum + count.attendanceCount, 0),
    quarter.attendanceCount,
  );
});

test("프로그램별 실인원을 더하면 센터 실인원보다 클 수 있다", () => {
  const quarter = report(buildQuarterExample(), quarterPeriod(2026, 1));

  assert.deepEqual(
    quarter.byCourse.map((row) => [row.courseName, row.uniqueParticipants, row.attendanceCount]),
    [
      ["미술", 2, 14],
      ["체육", 2, 7],
    ],
  );
  assert.equal(quarter.total.uniqueParticipants, 3);
});

test("성별·연령대·장애 유무로 나누고 거를 수 있다", () => {
  const data = buildQuarterExample();
  const quarter = report(data, quarterPeriod(2026, 1));

  assert.deepEqual(
    quarter.byGender.map((row) => [row.label, row.uniqueParticipants, row.attendanceCount]),
    [
      ["여성", 2, 11],
      ["남성", 1, 10],
    ],
  );
  assert.deepEqual(
    quarter.byAgeBand.map((row) => [row.label, row.uniqueParticipants]),
    [
      ["10대", 1],
      ["30대", 1],
      ["60대", 1],
    ],
  );
  assert.deepEqual(
    quarter.byDisability.map((row) => [row.label, row.uniqueParticipants, row.attendanceCount]),
    [
      ["장애인", 2, 11],
      ["비장애인", 1, 10],
    ],
  );

  const filtered = report(data, quarterPeriod(2026, 1), {
    courseIds: ["fitness"],
    hasDisability: true,
  });
  assert.deepEqual(filtered.total, { uniqueParticipants: 1, attendanceCount: 3 });
  assert.deepEqual(filtered.byCourse.map((row) => row.courseId), ["fitness"]);
});

test("기간·연령대 도우미는 경계를 맞게 계산한다", () => {
  assert.deepEqual(quarterPeriod(2026, 1), { startDate: "2026-01-01", endDate: "2026-03-31" });
  assert.deepEqual(quarterPeriod(2024, 1).endDate, "2024-03-31");
  assert.deepEqual(monthPeriod(2024, 2), { startDate: "2024-02-01", endDate: "2024-02-29" });
  assert.deepEqual(yearPeriod(2026), { startDate: "2026-01-01", endDate: "2026-12-31" });
  assert.equal(ageBandKey(2017, 2026), "0");
  assert.equal(ageBandLabel(ageBandKey(2017, 2026)), "10세 미만");
  assert.equal(ageBandLabel(ageBandKey(1961, 2026)), "60대");
  assert.equal(ageBandLabel(ageBandKey(null, 2026)), "미상");
});

test("마포 데모 데이터 전체 기간 보고서는 30명·1인 1수업 구조와 맞는다", () => {
  const fixture = buildMapoDashboardFixture({
    workspaceId: "22222222-2222-4222-8222-222222222222",
    referenceDate: "2026-09-03",
  });
  const result = buildParticipationReport({
    period: { startDate: "2026-06-01", endDate: "2026-09-30" },
    ageReferenceYear: 2026,
    courses: fixture.courses.map((course) => ({ id: course.id, name: course.name })),
    sessions: fixture.sessions.map((session) => ({
      id: session.id,
      courseId: session.course_id,
      date: session.date,
      rollupStatus: session.rollup_status,
      progressStatus: session.progress_status,
    })),
    participants: fixture.participants.map((participant) => ({
      id: participant.id,
      gender: participant.gender,
      birthYear: participant.birth_year,
      hasDisability: participant.has_disability,
    })),
    records: fixture.attendanceRecords.map((record) => ({
      sessionId: record.session_id,
      participantId: record.participant_id,
      status: record.status,
    })),
  });

  const attendedRecords = fixture.attendanceRecords.filter((record) =>
    ["present", "partial"].includes(record.status),
  );
  assert.equal(result.total.uniqueParticipants, 30);
  assert.equal(result.total.attendanceCount, attendedRecords.length);
  assert.ok(result.byCourse.every((row) => row.uniqueParticipants === 5));
  assert.equal(
    result.byCourse.reduce((sum, row) => sum + row.uniqueParticipants, 0),
    result.total.uniqueParticipants,
  );
  assert.deepEqual(
    result.byGender.map((row) => row.uniqueParticipants),
    [15, 15],
  );
  assert.deepEqual(
    result.byDisability.map((row) => row.uniqueParticipants),
    [19, 11],
  );
  assert.equal(
    result.byAgeBand.reduce((sum, row) => sum + row.uniqueParticipants, 0),
    30,
  );
});

test("월별 추이는 빈 달도 0으로 채우고 연인원 합이 분기 값과 같다", async () => {
  const { buildMonthlyTrend } = await import("../src/services/participation-report-logic.ts");
  const quarter = report(buildQuarterExample(), quarterPeriod(2026, 1));
  const trend = buildMonthlyTrend(quarter.period, quarter.evidence);
  assert.deepEqual(
    trend.map((row) => [row.month, row.uniqueParticipants, row.attendanceCount]),
    [
      ["2026-01", 3, 11],
      ["2026-02", 1, 4],
      ["2026-03", 2, 6],
    ],
  );
  assert.deepEqual(
    buildMonthlyTrend({ startDate: "2025-11-01", endDate: "2026-02-28" }, []).map((row) => row.month),
    ["2025-11", "2025-12", "2026-01", "2026-02"],
  );
});

test("교차표는 칸마다 중복을 빼고, 합계 줄도 원래 기록에서 다시 센다", async () => {
  const { buildCrossTab } = await import("../src/services/participation-report-logic.ts");
  const quarter = report(buildQuarterExample(), quarterPeriod(2026, 1));
  const table = buildCrossTab(quarter, "gender");

  assert.deepEqual(table.columns.map((column) => column.label), ["여성", "남성"]);
  const cell = (row, key) => [row.cells[key].uniqueParticipants, row.cells[key].attendanceCount];
  const art = table.rows.find((row) => row.courseId === "art");
  const fitness = table.rows.find((row) => row.courseId === "fitness");
  assert.deepEqual([cell(art, "female"), cell(art, "male")], [[1, 8], [1, 6]]);
  assert.deepEqual([cell(fitness, "female"), cell(fitness, "male")], [[1, 3], [1, 4]]);
  // B는 미술·체육 둘 다 들어도 남성 합계에서 1명
  assert.deepEqual([cell(table.totalRow, "female"), cell(table.totalRow, "male")], [[2, 11], [1, 10]]);
  assert.deepEqual(table.totalRow.total, { uniqueParticipants: 3, attendanceCount: 21 });

  const ages = buildCrossTab(quarter, "ageBand");
  assert.deepEqual(ages.columns.map((column) => column.label), ["10대", "30대", "60대"]);
});
