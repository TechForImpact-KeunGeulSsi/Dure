import assert from "node:assert/strict";
import test from "node:test";
import { crc32 } from "node:zlib";

import { buildXlsx, columnName } from "../src/lib/export/xlsx.ts";
import { buildParticipationReport, quarterPeriod } from "../src/services/participation-report-logic.ts";
import {
  DEFAULT_SUBMISSION_OPTIONS,
  buildParticipantRows,
  buildSubmissionSheets,
  maskName,
} from "../src/services/report-export-logic.ts";

function sampleInput(options = DEFAULT_SUBMISSION_OPTIONS) {
  const report = buildParticipationReport({
    period: quarterPeriod(2026, 3),
    ageReferenceYear: 2026,
    courses: [{ id: "art", name: "미술활동" }],
    sessions: [
      { id: "s1", courseId: "art", date: "2026-07-01", rollupStatus: "included", progressStatus: "scheduled" },
      { id: "s2", courseId: "art", date: "2026-07-08", rollupStatus: "included", progressStatus: "scheduled" },
    ],
    participants: [
      { id: "p1", gender: "female", birthYear: 1961, hasDisability: true },
      { id: "p2", gender: "male", birthYear: 2012, hasDisability: false },
    ],
    records: [
      { sessionId: "s1", participantId: "p1", status: "present" },
      { sessionId: "s2", participantId: "p1", status: "partial" },
      { sessionId: "s1", participantId: "p2", status: "present" },
      { sessionId: "s2", participantId: "p2", status: "absent" },
    ],
  });
  return {
    report,
    courseNames: new Map([["art", "미술활동"]]),
    participantNames: new Map([
      ["p1", "남궁선희"],
      ["p2", "홍길동"],
    ]),
    periodLabel: "2026년 3분기",
    missingRecordCount: 0,
    generatedAt: "2026. 10. 9. 오후 3:00",
    options,
  };
}

test("이름은 가운데를 가린다", () => {
  assert.equal(maskName("홍길동"), "홍*동");
  assert.equal(maskName("남궁선희"), "남**희");
  assert.equal(maskName("이수"), "이*");
  assert.equal(maskName("김"), "*");
});

test("참여자 명단은 고른 항목만 담고 원래 이름은 넣지 않는다", () => {
  const rows = buildParticipantRows(sampleInput());
  assert.deepEqual(rows, [
    ["번호", "이름", "성별", "연령대", "장애 유무", "수업", "참여 횟수"],
    [1, "남**희", "여", "60대", "예", "미술활동", 2],
    [2, "홍*동", "남", "10대", "아니오", "미술활동", 1],
  ]);

  const minimal = buildParticipantRows(
    sampleInput({ nameMode: "none", includeGender: false, includeAgeBand: false, includeDisability: false }),
  );
  assert.deepEqual(minimal[0], ["번호", "수업", "참여 횟수"]);
  assert.ok(minimal.flat().every((cell) => cell !== "남궁선희" && cell !== "홍길동"));
});

test("제출 파일은 요약·명단·계산 기준 시트를 숫자 값으로 담는다", () => {
  const sheets = buildSubmissionSheets(sampleInput());
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["요약", "참여자 명단", "계산 기준"]);
  const summary = sheets[0].rows;
  assert.deepEqual(summary.find((row) => row[0] === "실인원(명)"), ["실인원(명)", 2]);
  assert.deepEqual(summary.find((row) => row[0] === "연인원(회)"), ["연인원(회)", 3]);
  const allCells = sheets.flatMap((sheet) => sheet.rows.flat());
  assert.ok(allCells.every((cell) => typeof cell !== "string" || !cell.startsWith("=")));
});

test("xlsx는 올바른 zip 구조와 CRC를 가진다", () => {
  const bytes = buildXlsx(buildSubmissionSheets(sampleInput()));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);

  const endOffset = bytes.length - 22;
  assert.equal(view.getUint32(endOffset, true), 0x06054b50);
  const fileCount = view.getUint16(endOffset + 10, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  assert.equal(fileCount, 8);

  const decoder = new TextDecoder();
  const names = [];
  let position = centralOffset;
  for (let index = 0; index < fileCount; index += 1) {
    assert.equal(view.getUint32(position, true), 0x02014b50);
    const crc = view.getUint32(position + 16, true);
    const size = view.getUint32(position + 20, true);
    const nameLength = view.getUint16(position + 28, true);
    const localOffset = view.getUint32(position + 42, true);
    const name = decoder.decode(bytes.subarray(position + 46, position + 46 + nameLength));
    names.push(name);
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true);
    assert.equal(crc32(bytes.subarray(dataStart, dataStart + size)), crc, name);
    position += 46 + nameLength;
  }
  assert.ok(names.includes("xl/worksheets/sheet2.xml"));
  const workbook = decoder.decode(bytes);
  assert.match(workbook, /name="참여자 명단"/);
  assert.doesNotMatch(workbook, /<f>/);
});

test("열 이름은 A, Z, AA 순서로 붙는다", () => {
  assert.equal(columnName(0), "A");
  assert.equal(columnName(25), "Z");
  assert.equal(columnName(26), "AA");
});

test("교차표 시트는 고른 항목만 담고 합계 줄은 중복을 뺀다", async () => {
  const { buildCrossTab, buildMonthlyTrend } = await import("../src/services/participation-report-logic.ts");
  const base = sampleInput();
  const crossTabs = ["gender", "disability", "ageBand"].map((dimension) => buildCrossTab(base.report, dimension));
  const sheets = buildSubmissionSheets({
    ...base,
    options: { ...DEFAULT_SUBMISSION_OPTIONS, includeAgeBand: false },
    monthlyTrend: buildMonthlyTrend(base.report.period, base.report.evidence),
    crossTabs,
  });
  assert.deepEqual(sheets.map((sheet) => sheet.name), ["요약", "교차표", "참여자 명단", "계산 기준"]);
  const cross = sheets[1].rows;
  assert.ok(cross.some((row) => row[0] === "수업 × 성별"));
  assert.ok(cross.some((row) => row[0] === "수업 × 장애 유무"));
  assert.equal(cross.some((row) => row[0] === "수업 × 연령대"), false);
  assert.deepEqual(cross.find((row) => row[0] === "합계(중복 제외)"), ["합계(중복 제외)", 1, 2, 1, 1, 2, 3]);
  assert.ok(sheets[0].rows.some((row) => row[0] === "월"));
});
