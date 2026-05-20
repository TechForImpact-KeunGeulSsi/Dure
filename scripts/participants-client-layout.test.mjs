import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "src/app/workspaces/[workspaceId]/(dashboard)/manage/participants/participants-client.tsx",
  "utf8",
);

test("participant table uses fixed layout so long memos do not resize columns", () => {
  assert.match(source, /<Table className="table-fixed">/);
});

test("participant memo cell constrains overflowing text inside the cell", () => {
  assert.match(source, /<Td className="w-\[18rem\]/);
  assert.match(source, /<span className="block truncate"/);
});
