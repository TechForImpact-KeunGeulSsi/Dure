// api-spec.md §11 + architecture.md §10 — 자료 업로드 정책

// 확장자/MIME/크기 정책은 supabase/migrations 의 storage bucket 정의와 동일해야 함
// 양쪽이 어긋나면 클라이언트 사전 검증을 통과해도 Storage가 거부할 수 있음

import { z } from "zod";

export const MATERIAL_MAX_SIZE_BYTES = 52_428_800 as const; // 50MB

export const MATERIAL_ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
  "jpg", "jpeg", "png", "txt", "zip",
] as const;

export const MATERIAL_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/zip",
] as const;

const ReviewStatusEnum = z.enum(["pending", "reviewed"]);

const TitleSchema = z
  .string()
  .trim()
  .min(1, "제목을 입력해 주세요.")
  .max(120, "제목은 120자 이하로 입력해 주세요.");

const DescriptionSchema = z
  .string()
  .max(1000, "설명은 1000자 이하로 입력해 주세요.")
  .nullable()
  .optional();

const FilenameSchema = z
  .string()
  .trim()
  .min(1, "파일 이름이 필요합니다.")
  .max(255, "파일 이름은 255자 이하여야 합니다.");

const MimeSchema = z.string().trim().min(1, "MIME 타입이 필요합니다.");
const SizeSchema = z
  .number()
  .int("파일 크기는 정수여야 합니다.")
  .nonnegative("파일 크기는 0 이상이어야 합니다.")
  .max(MATERIAL_MAX_SIZE_BYTES, "파일은 50MB 이하여야 합니다.");

// api-spec.md §11.2
export const PrepareMaterialUploadSchema = z.object({
  title: TitleSchema,
  description: DescriptionSchema,
  originalFilename: FilenameSchema,
  mimeType: MimeSchema,
  sizeBytes: SizeSchema,
});

export type PrepareMaterialUploadInput = z.infer<typeof PrepareMaterialUploadSchema>;

// api-spec.md §11.4
export const UpdateMaterialSchema = z.object({
  title: TitleSchema.optional(),
  description: DescriptionSchema,
});

export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;

// api-spec.md §11.5
export const ReplaceMaterialFileSchema = z.object({
  originalFilename: FilenameSchema,
  mimeType: MimeSchema,
  sizeBytes: SizeSchema,
});

export type ReplaceMaterialFileInput = z.infer<typeof ReplaceMaterialFileSchema>;

// api-spec.md §11.6
export const UpdateMaterialReviewStatusSchema = z.object({
  reviewStatus: ReviewStatusEnum,
});

export type UpdateMaterialReviewStatusInput = z.infer<
  typeof UpdateMaterialReviewStatusSchema
>;

// 파일명에서 확장자만 소문자로 추출, 확장자 없으면 빈 문자열
export function extractExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

// 확장자/MIME/크기를 함께 검증, 메타데이터 수정·파일 교체에서도 재사용
export function validateUploadPolicy(file: {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; field: string; message: string } {
  const ext = extractExtension(file.originalFilename);
  if (!ext) {
    return { ok: false, field: "originalFilename", message: "파일 확장자가 필요합니다." };
  }
  if (!MATERIAL_ALLOWED_EXTENSIONS.includes(ext as (typeof MATERIAL_ALLOWED_EXTENSIONS)[number])) {
    return { ok: false, field: "originalFilename", message: "허용되지 않은 확장자입니다." };
  }
  if (
    !MATERIAL_ALLOWED_MIME_TYPES.includes(
      file.mimeType as (typeof MATERIAL_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return { ok: false, field: "mimeType", message: "허용되지 않은 파일 형식입니다." };
  }
  if (file.sizeBytes > MATERIAL_MAX_SIZE_BYTES) {
    return { ok: false, field: "sizeBytes", message: "파일은 50MB 이하여야 합니다." };
  }
  return { ok: true };
}

// Storage object name 안전화, 영문/숫자/일부 기호만 남김
export function safeFilename(filename: string): string {
  const trimmed = filename.trim().replace(/\s+/g, "_");
  const cleaned = trimmed.replace(/[^A-Za-z0-9._\-]/g, "");
  return cleaned.length > 0 ? cleaned : "file";
}
