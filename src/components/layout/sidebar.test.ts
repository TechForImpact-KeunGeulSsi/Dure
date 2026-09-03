import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(new URL("./sidebar.tsx", import.meta.url));
const source = readFileSync(sourcePath, "utf8");

assert.doesNotMatch(source, /마을별 둘러보기|정산 요청|의견 수렴/);
assert.match(source, /label: "대시보드"/);
assert.match(source, /label: "수업·참여자"/);
assert.match(source, /label: "운영자·강사"/);
assert.doesNotMatch(source, /label: "일정 관리"/);
