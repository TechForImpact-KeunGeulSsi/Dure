"use client";

import { useState, useTransition, type FormEvent } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  COURSE_FEEDBACK_MESSAGE_MAX_LENGTH,
  COURSE_FEEDBACK_MESSAGE_MIN_LENGTH,
} from "@/lib/validators/course-feedback";
import { createCourseFeedback } from "@/services/course-feedbacks";

type Props = {
  courseId: string;
};

const CATEGORIES = [
  { value: "suggestion", label: "제안" },
  { value: "praise", label: "좋았던 점" },
  { value: "other", label: "기타" },
] as const;

export function PublicCourseFeedbackForm({ courseId }: Props) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>(
    "suggestion",
  );
  const [message, setMessage] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorPhone, setAuthorPhone] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(false);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createCourseFeedback(courseId, {
        category,
        message,
        authorName,
        authorPhone,
        privacyConsent,
      });
      if (!result.ok) {
        if (result.error.fieldErrors) setFieldErrors(result.error.fieldErrors);
        toast.error(firstFieldError(result.error.fieldErrors) ?? result.error.message);
        return;
      }
      setMessage("");
      setAuthorName("");
      setAuthorPhone("");
      setPrivacyConsent(false);
      setFieldErrors({});
      setCategory("suggestion");
      setSuccess(true);
    });
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-blue-700" />
        <h2 className="text-base font-semibold text-gray-950">
          이 수업에 의견 남기기
        </h2>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-gray-700">
            <span>구분</span>
            <Select
              aria-invalid={Boolean(fieldErrors.category)}
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as typeof category)
              }
              disabled={pending}
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <FieldError errors={fieldErrors.category} />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-gray-700">
            <span>성함</span>
            <Input
              aria-invalid={Boolean(fieldErrors.authorName)}
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="선택 입력"
              maxLength={50}
              disabled={pending}
            />
            <FieldError errors={fieldErrors.authorName} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-gray-700">
            <span>전화번호</span>
            <Input
              aria-invalid={Boolean(fieldErrors.authorPhone)}
              value={authorPhone}
              onChange={(event) => setAuthorPhone(event.target.value)}
              placeholder="010-0000-0000"
              maxLength={30}
              disabled={pending}
            />
            <FieldError errors={fieldErrors.authorPhone} />
          </label>
        </div>

        <label className="space-y-1.5 text-sm font-medium text-gray-700">
          <span className="flex items-center justify-between gap-2">
            <span>의견</span>
            <span className="text-xs font-normal text-gray-500">
              {COURSE_FEEDBACK_MESSAGE_MIN_LENGTH}자 이상{" "}
              {COURSE_FEEDBACK_MESSAGE_MAX_LENGTH}자 이하
            </span>
          </span>
          <Textarea
            aria-invalid={Boolean(fieldErrors.message)}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="수업에 대한 의견을 남겨 주세요."
            rows={5}
            maxLength={COURSE_FEEDBACK_MESSAGE_MAX_LENGTH}
            disabled={pending}
          />
          <FieldError errors={fieldErrors.message} />
        </label>

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(event) => setPrivacyConsent(event.target.checked)}
            disabled={pending}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
          <span>
            남긴 의견과 선택 입력한 성함, 전화번호를 수업 운영자가 확인하는 데
            동의합니다.
          </span>
        </label>
        <FieldError errors={fieldErrors.privacyConsent} />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "전달 중..." : "의견 보내기"}
          </Button>
          {success ? (
            <p className="text-sm font-medium text-emerald-700">
              의견이 전달되었습니다.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return <p className="text-xs font-medium text-rose-600">{errors[0]}</p>;
}

function firstFieldError(fieldErrors?: Record<string, string[]>): string | null {
  if (!fieldErrors) return null;
  for (const errors of Object.values(fieldErrors)) {
    if (errors[0]) return errors[0];
  }
  return null;
}
