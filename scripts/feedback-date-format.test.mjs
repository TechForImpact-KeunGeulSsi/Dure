import assert from "node:assert/strict";
import test from "node:test";

import { formatFeedbackDateTime } from "../src/lib/utils/format-feedback-date-time.ts";

test("feedback timestamps use deterministic 24-hour Korean formatting", () => {
  assert.equal(
    formatFeedbackDateTime("2026-08-02T03:26:00.000Z", "Asia/Seoul"),
    "2026. 08. 02. 12:26",
  );
  assert.doesNotMatch(
    formatFeedbackDateTime("2026-08-02T03:26:00.000Z", "Asia/Seoul"),
    /오전|오후|AM|PM/,
  );
});
