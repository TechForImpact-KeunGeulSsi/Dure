import * as assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CreateCourseFeedbackSchema } = require("./course-feedback.ts");

const validInput = {
  category: "suggestion",
  message: "아이들이 수업 내용을 더 오래 기억할 수 있는 활동지가 있으면 좋겠습니다.",
  authorName: "",
  authorPhone: "",
  privacyConsent: true,
};

assert.equal(CreateCourseFeedbackSchema.safeParse(validInput).success, true);

assert.equal(
  CreateCourseFeedbackSchema.safeParse({
    ...validInput,
    category: "concern",
  }).success,
  false,
);

assert.equal(
  CreateCourseFeedbackSchema.safeParse({
    ...validInput,
    privacyConsent: false,
  }).success,
  false,
);

const shortMessage = CreateCourseFeedbackSchema.safeParse({
  ...validInput,
  message: "좋아요",
});
assert.equal(shortMessage.success, false);
if (!shortMessage.success) {
  assert.deepEqual(shortMessage.error.flatten().fieldErrors.message, [
    "의견은 10자 이상 입력해 주세요.",
  ]);
}

const missingConsent = CreateCourseFeedbackSchema.safeParse({
  ...validInput,
  privacyConsent: false,
});
assert.equal(missingConsent.success, false);
if (!missingConsent.success) {
  assert.deepEqual(missingConsent.error.flatten().fieldErrors.privacyConsent, [
    "개인정보 수집 및 이용에 동의해 주세요.",
  ]);
}

assert.equal(
  CreateCourseFeedbackSchema.safeParse({
    ...validInput,
    authorName: "",
    authorPhone: "010-1234-5678",
  }).success,
  false,
);

assert.equal(
  CreateCourseFeedbackSchema.safeParse({
    ...validInput,
    authorName: "김보호",
    authorPhone: "010-1234-5678",
  }).success,
  true,
);
