import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(
  new URL("./public-course-feedback-form.tsx", import.meta.url),
);
const source = readFileSync(sourcePath, "utf8");

assert.match(source, /COURSE_FEEDBACK_MESSAGE_MIN_LENGTH.*자 이상/s);
assert.match(source, /COURSE_FEEDBACK_MESSAGE_MAX_LENGTH.*자 이하/s);
assert.match(source, /maxLength=\{COURSE_FEEDBACK_MESSAGE_MAX_LENGTH\}/);
