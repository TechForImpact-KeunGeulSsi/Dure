"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  MemberSummary,
  SettlementRequestDetail,
  SettlementRequestItem,
  SettlementRequestListItem,
  SettlementRequestReceipt,
  SettlementRequestStatus,
  UUID,
} from "@/lib/api/types";
import {
  CreateSettlementRequestSchema,
  safeReceiptFilename,
  validateReceiptPolicy,
  type CreateSettlementRequestInput,
} from "@/lib/validators/settlement";

import { loadCurrentMembership } from "./access";
import { logActivity } from "./activity";

const RECEIPT_BUCKET = "course-materials";
const RECEIPT_SIGNED_URL_EXPIRES_SECONDS = 60 * 60;

// ─────────────────────────────────────────────────────────────
// 강사용: 본인이 해당 수업에 낸 정산 요청 목록
// ─────────────────────────────────────────────────────────────

export async function listMySettlementRequestsForCourse(
  workspaceId: UUID,
  courseId: UUID,
): Promise<ApiResult<{ requests: SettlementRequestListItem[] }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("settlement_requests")
    .select(
      "id, course_id, instructor_member_id, total_amount, status, created_at, paid_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("instructor_member_id", membership.memberId)
    .order("created_at", { ascending: false });
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const rows = (data ?? []) as Array<{
    id: UUID;
    course_id: UUID;
    instructor_member_id: UUID;
    total_amount: number;
    status: SettlementRequestStatus;
    created_at: string;
    paid_at: string | null;
  }>;

  if (rows.length === 0) {
    return apiOk({ requests: [] });
  }

  // course name + instructor + item counts 보조 조회
  const requestIds = rows.map((r) => r.id);
  const [course, instructor, itemCounts] = await Promise.all([
    loadCourseName(workspaceId, courseId),
    loadMemberSummary(membership.memberId),
    loadItemCounts(requestIds),
  ]);

  const requests: SettlementRequestListItem[] = rows.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    courseName: course,
    instructor,
    totalAmount: Number(r.total_amount),
    itemCount: itemCounts.get(r.id) ?? 0,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  }));

  return apiOk({ requests });
}

// ─────────────────────────────────────────────────────────────
// 운영자용: 워크스페이스 전체 정산 요청 목록
// ─────────────────────────────────────────────────────────────

export async function listWorkspaceSettlementRequests(
  workspaceId: UUID,
  filter?: { status?: SettlementRequestStatus },
): Promise<ApiResult<{ requests: SettlementRequestListItem[] }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }
  if (membership.role !== "owner_admin") {
    return apiError("ROLE_FORBIDDEN", "운영자만 정산 요청을 조회할 수 있습니다.");
  }

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("settlement_requests")
    .select(
      "id, course_id, instructor_member_id, total_amount, status, created_at, paid_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const rows = (data ?? []) as Array<{
    id: UUID;
    course_id: UUID;
    instructor_member_id: UUID;
    total_amount: number;
    status: SettlementRequestStatus;
    created_at: string;
    paid_at: string | null;
  }>;

  if (rows.length === 0) {
    return apiOk({ requests: [] });
  }

  const courseIds = [...new Set(rows.map((r) => r.course_id))];
  const memberIds = [...new Set(rows.map((r) => r.instructor_member_id))];
  const requestIds = rows.map((r) => r.id);

  const [courseMap, memberMap, itemCounts] = await Promise.all([
    loadCourseMap(workspaceId, courseIds),
    loadMemberMap(memberIds),
    loadItemCounts(requestIds),
  ]);

  const requests: SettlementRequestListItem[] = rows.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    courseName: courseMap.get(r.course_id) ?? "(삭제된 수업)",
    instructor: memberMap.get(r.instructor_member_id) ?? null,
    totalAmount: Number(r.total_amount),
    itemCount: itemCounts.get(r.id) ?? 0,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  }));

  return apiOk({ requests });
}

// ─────────────────────────────────────────────────────────────
// 상세 조회: items + receipts 조인.
// 권한: owner_admin 또는 본인 강사.
// ─────────────────────────────────────────────────────────────

export async function getSettlementRequestDetail(
  workspaceId: UUID,
  requestId: UUID,
): Promise<ApiResult<{ request: SettlementRequestDetail }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("settlement_requests")
    .select(
      "id, workspace_id, course_id, instructor_member_id, bank_name_snapshot, account_number_snapshot, account_holder_snapshot, memo, total_amount, status, paid_at, paid_by, created_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();
  if (error) return apiError("INTERNAL_ERROR", error.message);
  if (!row) return apiError("NOT_FOUND", "정산 요청을 찾을 수 없습니다.");

  // 권한 확인
  const isOwner = membership.role === "owner_admin";
  const isMine = row.instructor_member_id === membership.memberId;
  if (!isOwner && !isMine) {
    return apiError("SCOPE_FORBIDDEN", "해당 정산 요청을 볼 권한이 없습니다.");
  }

  const [course, instructor, paidBy, items, receipts] = await Promise.all([
    loadCourseName(workspaceId, row.course_id),
    loadMemberSummary(row.instructor_member_id),
    row.paid_by ? loadMemberSummary(row.paid_by) : Promise.resolve(null),
    loadItems(requestId),
    loadReceipts(requestId),
  ]);

  return apiOk({
    request: {
      id: row.id,
      workspaceId: row.workspace_id,
      courseId: row.course_id,
      courseName: course,
      instructor,
      bankNameSnapshot: row.bank_name_snapshot,
      accountNumberSnapshot: row.account_number_snapshot,
      accountHolderSnapshot: row.account_holder_snapshot,
      memo: row.memo,
      totalAmount: Number(row.total_amount),
      status: row.status,
      items,
      receipts,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      paidBy,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// 새 정산 요청 생성 (강사)
// FormData 필드:
//  - payload: JSON.stringify({ memo, items: [{itemName, quantity, unitPrice}] })
//  - receipt_N: File (선택적, 다중)
// ─────────────────────────────────────────────────────────────

export async function createSettlementRequest(
  workspaceId: UUID,
  courseId: UUID,
  formData: FormData,
): Promise<ApiResult<{ requestId: UUID }>> {
  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string") {
    return apiError("VALIDATION_FAILED", "요청 본문이 없습니다.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return apiError("VALIDATION_FAILED", "요청 본문 형식이 잘못되었습니다.");
  }
  const parsed = CreateSettlementRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }
  if (membership.role !== "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사만 정산을 요청할 수 있습니다.");
  }

  const admin = createSupabaseAdminClient();

  // course가 본인 담당인지 확인
  const { data: course } = await admin
    .from("courses")
    .select("id, name, instructor_member_id, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");
  if (course.instructor_member_id !== membership.memberId) {
    return apiError("SCOPE_FORBIDDEN", "담당 수업에만 정산을 요청할 수 있습니다.");
  }

  // 본인 계좌 정보 로드 (스냅샷)
  const supabase = await createSupabaseServerClient();
  const { data: account } = await supabase
    .from("instructor_payout_accounts")
    .select("bank_name, account_number, account_holder")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!account) {
    return apiError(
      "VALIDATION_FAILED",
      "정산 요청 전에 계좌 정보를 먼저 등록해 주세요.",
    );
  }

  // 영수증 파일들 수집 (선택적)
  const receiptFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("receipt_") && value instanceof File && value.size > 0) {
      const policy = validateReceiptPolicy({
        originalFilename: value.name,
        mimeType: value.type || "application/octet-stream",
        sizeBytes: value.size,
      });
      if (!policy.ok) {
        return apiError("UPLOAD_POLICY_VIOLATION", policy.message, {
          fieldErrors: { [policy.field]: [policy.message] },
        });
      }
      receiptFiles.push(value);
    }
  }

  // 총액 계산
  const totalAmount = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  // 1) settlement_requests INSERT
  const { data: inserted, error: insertError } = await admin
    .from("settlement_requests")
    .insert({
      workspace_id: workspaceId,
      course_id: courseId,
      instructor_member_id: membership.memberId,
      bank_name_snapshot: account.bank_name,
      account_number_snapshot: account.account_number,
      account_holder_snapshot: account.account_holder,
      memo: parsed.data.memo ?? "",
      total_amount: totalAmount,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return apiError(
      "INTERNAL_ERROR",
      insertError?.message ?? "정산 요청을 생성하지 못했습니다.",
    );
  }
  const requestId: UUID = inserted.id;

  // 2) items INSERT (배치)
  const itemRows = parsed.data.items.map((item, idx) => ({
    settlement_request_id: requestId,
    item_name: item.itemName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    sort_order: idx,
  }));
  const { error: itemsError } = await admin
    .from("settlement_request_items")
    .insert(itemRows);
  if (itemsError) {
    await admin.from("settlement_requests").delete().eq("id", requestId);
    return apiError("INTERNAL_ERROR", itemsError.message);
  }

  // 3) 영수증 파일들 업로드
  for (const file of receiptFiles) {
    const fileId = randomUUID();
    const safeName = safeReceiptFilename(file.name);
    const storagePath = `workspaces/${workspaceId}/settlements/${requestId}/${fileId}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(RECEIPT_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) {
      // 부분 실패: 이미 업로드된 파일은 일단 두고 메타만 정리 → 사용자에게 에러 전달
      await admin.from("settlement_requests").delete().eq("id", requestId);
      return apiError("INTERNAL_ERROR", uploadError.message);
    }

    const { error: receiptInsertError } = await admin
      .from("settlement_request_receipts")
      .insert({
        settlement_request_id: requestId,
        original_filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        storage_path: storagePath,
      });
    if (receiptInsertError) {
      await admin.storage.from(RECEIPT_BUCKET).remove([storagePath]);
      await admin.from("settlement_requests").delete().eq("id", requestId);
      return apiError("INTERNAL_ERROR", receiptInsertError.message);
    }
  }

  await logActivity({
    workspaceId,
    actorMemberId: membership.memberId,
    eventType: "settlement_requested",
    targetType: "settlement_request",
    targetId: requestId,
    metadata: {
      courseId,
      courseName: course.name,
      totalAmount,
    },
  });

  revalidatePath(
    `/workspaces/${workspaceId}/teach/courses/${courseId}/settlements`,
  );
  revalidatePath(`/workspaces/${workspaceId}/settlements`);

  return apiOk({ requestId });
}

// ─────────────────────────────────────────────────────────────
// 강사: 본인의 대기 상태 정산 요청 수정 (items + memo)
// 영수증은 이번 범위에서 변경 대상 아님.
// ─────────────────────────────────────────────────────────────

export async function updateSettlementRequest(
  workspaceId: UUID,
  requestId: UUID,
  rawInput: CreateSettlementRequestInput,
): Promise<ApiResult<{ requestId: UUID }>> {
  const parsed = CreateSettlementRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("settlement_requests")
    .select("id, instructor_member_id, status, course_id")
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "정산 요청을 찾을 수 없습니다.");
  if (existing.instructor_member_id !== membership.memberId) {
    return apiError("SCOPE_FORBIDDEN", "본인의 정산 요청만 수정할 수 있습니다.");
  }
  if (existing.status !== "pending") {
    return apiError(
      "CONFLICT",
      "지급 완료된 요청은 수정할 수 없습니다.",
    );
  }

  const totalAmount = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  // 기존 items 전부 삭제 후 재삽입 (단순성 우선).
  const { error: deleteError } = await admin
    .from("settlement_request_items")
    .delete()
    .eq("settlement_request_id", requestId);
  if (deleteError) return apiError("INTERNAL_ERROR", deleteError.message);

  const itemRows = parsed.data.items.map((item, idx) => ({
    settlement_request_id: requestId,
    item_name: item.itemName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    sort_order: idx,
  }));
  const { error: insertError } = await admin
    .from("settlement_request_items")
    .insert(itemRows);
  if (insertError) return apiError("INTERNAL_ERROR", insertError.message);

  const { error: updateError } = await admin
    .from("settlement_requests")
    .update({
      memo: parsed.data.memo ?? "",
      total_amount: totalAmount,
    })
    .eq("id", requestId);
  if (updateError) return apiError("INTERNAL_ERROR", updateError.message);

  revalidatePath(
    `/workspaces/${workspaceId}/teach/courses/${existing.course_id}/settlements`,
  );
  revalidatePath(`/workspaces/${workspaceId}/settlements`);
  revalidatePath(`/workspaces/${workspaceId}/settlements/${requestId}`);

  return apiOk({ requestId });
}

// ─────────────────────────────────────────────────────────────
// 운영자: 지급 완료 처리
// ─────────────────────────────────────────────────────────────

export async function markSettlementRequestPaid(
  workspaceId: UUID,
  requestId: UUID,
): Promise<ApiResult<{ requestId: UUID }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }
  if (membership.role !== "owner_admin") {
    return apiError("ROLE_FORBIDDEN", "운영자만 지급 완료 처리할 수 있습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("settlement_requests")
    .select("id, status, course_id, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();
  if (!existing) return apiError("NOT_FOUND", "정산 요청을 찾을 수 없습니다.");
  if (existing.status === "paid") {
    return apiError("CONFLICT", "이미 지급 완료된 요청입니다.");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("settlement_requests")
    .update({
      status: "paid",
      paid_at: now,
      paid_by: membership.memberId,
    })
    .eq("id", requestId);
  if (updateError) return apiError("INTERNAL_ERROR", updateError.message);

  await logActivity({
    workspaceId,
    actorMemberId: membership.memberId,
    eventType: "settlement_paid",
    targetType: "settlement_request",
    targetId: requestId,
    metadata: {
      courseId: existing.course_id,
      instructorMemberId: existing.instructor_member_id,
    },
  });

  revalidatePath(`/workspaces/${workspaceId}/settlements`);
  revalidatePath(`/workspaces/${workspaceId}/settlements/${requestId}`);
  revalidatePath(
    `/workspaces/${workspaceId}/teach/courses/${existing.course_id}/settlements`,
  );

  return apiOk({ requestId });
}

// ─────────────────────────────────────────────────────────────
// 영수증 다운로드용 signed URL
// ─────────────────────────────────────────────────────────────

export async function getReceiptSignedUrl(
  workspaceId: UUID,
  requestId: UUID,
  receiptId: UUID,
): Promise<ApiResult<{ url: string; filename: string }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("settlement_request_receipts")
    .select("id, settlement_request_id, storage_path, original_filename")
    .eq("id", receiptId)
    .eq("settlement_request_id", requestId)
    .maybeSingle();
  if (!row) return apiError("NOT_FOUND", "영수증을 찾을 수 없습니다.");

  const { data: parent } = await admin
    .from("settlement_requests")
    .select("workspace_id, instructor_member_id")
    .eq("id", row.settlement_request_id)
    .maybeSingle();
  if (!parent || parent.workspace_id !== workspaceId) {
    return apiError("NOT_FOUND", "영수증을 찾을 수 없습니다.");
  }
  const isOwner = membership.role === "owner_admin";
  const isMine = parent.instructor_member_id === membership.memberId;
  if (!isOwner && !isMine) {
    return apiError("SCOPE_FORBIDDEN", "영수증을 볼 권한이 없습니다.");
  }

  const { data: signed, error } = await admin.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(row.storage_path, RECEIPT_SIGNED_URL_EXPIRES_SECONDS);
  if (error || !signed?.signedUrl) {
    return apiError(
      "INTERNAL_ERROR",
      error?.message ?? "다운로드 링크를 만들지 못했습니다.",
    );
  }

  return apiOk({ url: signed.signedUrl, filename: row.original_filename });
}

// ─────────────────────────────────────────────────────────────
// 헬퍼들
// ─────────────────────────────────────────────────────────────

async function loadCourseName(
  workspaceId: UUID,
  courseId: UUID,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("courses")
    .select("name")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  return data?.name ?? "(삭제된 수업)";
}

async function loadCourseMap(
  workspaceId: UUID,
  courseIds: UUID[],
): Promise<Map<UUID, string>> {
  const result = new Map<UUID, string>();
  if (courseIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("courses")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .in("id", courseIds);
  for (const row of data ?? []) {
    result.set(row.id, row.name);
  }
  return result;
}

async function loadMemberSummary(
  memberId: UUID,
): Promise<MemberSummary | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("id, email, display_name, role, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    status: data.status,
  };
}

async function loadMemberMap(
  memberIds: UUID[],
): Promise<Map<UUID, MemberSummary>> {
  const result = new Map<UUID, MemberSummary>();
  if (memberIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("id, email, display_name, role, status")
    .in("id", memberIds);
  for (const row of data ?? []) {
    result.set(row.id, {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
    });
  }
  return result;
}

async function loadItemCounts(
  requestIds: UUID[],
): Promise<Map<UUID, number>> {
  const result = new Map<UUID, number>();
  if (requestIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("settlement_request_items")
    .select("settlement_request_id")
    .in("settlement_request_id", requestIds);
  for (const row of (data ?? []) as Array<{ settlement_request_id: UUID }>) {
    result.set(
      row.settlement_request_id,
      (result.get(row.settlement_request_id) ?? 0) + 1,
    );
  }
  return result;
}

async function loadItems(
  requestId: UUID,
): Promise<SettlementRequestItem[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("settlement_request_items")
    .select("id, item_name, quantity, unit_price, subtotal, sort_order")
    .eq("settlement_request_id", requestId)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id,
    itemName: row.item_name,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    subtotal: Number(row.subtotal),
    sortOrder: row.sort_order,
  }));
}

async function loadReceipts(
  requestId: UUID,
): Promise<SettlementRequestReceipt[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("settlement_request_receipts")
    .select("id, original_filename, mime_type, size_bytes, storage_path, uploaded_at")
    .eq("settlement_request_id", requestId)
    .order("uploaded_at", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storagePath: row.storage_path,
    uploadedAt: row.uploaded_at,
  }));
}

function collectFieldErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (result[path] ??= []).push(issue.message);
  }
  return result;
}
