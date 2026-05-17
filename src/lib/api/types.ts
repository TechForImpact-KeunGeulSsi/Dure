// Mirrors docs/api-spec.md §1.6 (enums), §1.7 (IDs/time), and §2 (common DTOs).
// Keep this file aligned with that spec — pages and services share these types.

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISOTime = string; // HH:mm:ss
export type ISODateTime = string; // ISO 8601 timestamptz

// --- Enums (api-spec.md §1.6) ---

export type WorkspaceRole = "owner_admin" | "group_admin" | "instructor";
export type MemberStatus = "active" | "invited" | "disabled" | "removed";
export type GroupStatus = "active" | "inactive";
export type ParticipantStatus = "active" | "inactive" | "deleted";
export type ParticipantGroupStatus = "active" | "removed";
export type CourseParticipantStatus = "active" | "excluded";
export type CourseStatus = "planned" | "in_progress" | "completed";
export type SessionType = "regular" | "makeup" | "special" | "practice";
export type SessionVisibilityStatus = "visible" | "hidden";
export type SessionRollupStatus = "included" | "excluded";
export type SessionProgressStatus = "scheduled" | "cancelled";
export type MaterialUploadStatus = "uploading" | "uploaded" | "failed";
export type MaterialReviewStatus = "pending" | "reviewed";
export type AttendanceStatus = "present" | "partial" | "absent";
export type MaterialVisibilityScope = "all_course_groups" | "selected_groups";
export type SettlementRequestStatus = "pending" | "paid";

// --- Pagination (api-spec.md §1.5) ---

export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
};

export type SortDirection = "asc" | "desc";

// --- Workspace / Member (api-spec.md §2.1, §2.2) ---

export type MemberSummary = {
  id: UUID;
  email: string;
  displayName: string | null;
  role: WorkspaceRole;
  status: MemberStatus;
};

export type MemberWithScope = MemberSummary & {
  groupIds: UUID[];
  courseIds: UUID[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type WorkspaceSummary = {
  id: UUID;
  name: string;
  timezone: string;
  currentMember: MemberSummary;
};

// --- Group (api-spec.md §2.3) ---

export type GroupSummary = {
  id: UUID;
  name: string;
  description: string | null;
  status: GroupStatus;
};

export type GroupListItem = GroupSummary & {
  participantCount: number;
  courseCount: number;
  canEditDescription: boolean;
  canManageLifecycle: boolean;
};

// --- Participant (api-spec.md §2.4) ---

export type ParticipantSummary = {
  id: UUID;
  name: string;
  memo: string | null;
  status: ParticipantStatus;
};

export type ParticipantListItem = ParticipantSummary & {
  groups: GroupSummary[];
  courseCount: number;
  canEditMaster: boolean;
  canRemoveFromAccessibleGroups: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

// --- Course (api-spec.md §2.5) ---

export type CourseSummary = {
  id: UUID;
  name: string;
  status: CourseStatus;
  startsOn: ISODate | null;
  endsOn: ISODate | null;
  cardColor: string | null;
  bannerUrl: string | null;
};

export type InstructorSummary = {
  id: UUID;
  email: string;
  displayName: string | null;
  status: MemberStatus;
};

export type CourseListItem = CourseSummary & {
  groups: GroupSummary[];
  instructor: InstructorSummary | null;
  participantCount: number;
  sessionCount: number;
  canManageFullCourse: boolean;
  canManageScopedParticipants: boolean;
};

// --- Session (api-spec.md §2.6) ---

export type CourseSessionSummary = {
  id: UUID;
  courseId: UUID;
  courseName: string;
  sessionNo: number;
  date: ISODate;
  startsAt: ISOTime;
  endsAt: ISOTime;
  type: SessionType;
  visibilityStatus: SessionVisibilityStatus;
  rollupStatus: SessionRollupStatus;
  progressStatus: SessionProgressStatus;
};

// --- Material (api-spec.md §2.7) ---

export type MaterialListItem = {
  id: UUID;
  courseId: UUID;
  title: string;
  description: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: MemberSummary | null;
  uploadStatus: MaterialUploadStatus;
  reviewStatus: MaterialReviewStatus;
  visibilityScope: MaterialVisibilityScope;
  visibleGroups: GroupSummary[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  canEdit: boolean;
  canReplaceFile: boolean;
  canChangeReviewStatus: boolean;
  canDownload: boolean;
};

// --- Attendance (api-spec.md §2.8) ---

export type AttendanceRecordDto = {
  id: UUID;
  sessionId: UUID;
  participantId: UUID;
  participantName: string;
  status: AttendanceStatus;
  note: string | null;
  updatedBy: MemberSummary | null;
  updatedAt: ISODateTime;
};

// --- Workspace context (api-spec.md §3.1) ---

export type WorkspaceCapabilities = {
  canManageMembers: boolean;
  canCreateGroups: boolean;
  canCreateCourses: boolean;
  canCreateParticipants: boolean;
  canViewGeneralSchedule: boolean;
  canViewRecentActivity: boolean;
};

export type GetWorkspaceContextOutput = {
  workspace: WorkspaceSummary;
  accessibleGroups: GroupSummary[];
  capabilities: WorkspaceCapabilities;
};

// --- Activity log (api-spec.md §16) ---

export type ActivityTarget =
  | { type: "course"; courseId: UUID; href: string }
  | { type: "course_material"; courseId: UUID; materialId: UUID; href: string }
  | { type: "attendance"; courseId: UUID; sessionId: UUID; href: string }
  | { type: "class_memo"; courseId: UUID; sessionId: UUID; href: string }
  | { type: "member"; memberId: UUID; href: string }
  | { type: "settlement_request"; requestId: UUID; href: string };

export type ActivityItem = {
  id: UUID;
  eventType: string;
  title: string;
  description: string | null;
  actor: MemberSummary | null;
  target: ActivityTarget;
  createdAt: ISODateTime;
};

export type LoggableTargetType =
  | "material"
  | "attendance"
  | "class_memo"
  | "member"
  | "course"
  | "settlement_request";

// --- Settlement requests (정산 요청) ---

export type PayoutAccount = {
  id: UUID;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type SettlementRequestItem = {
  id: UUID;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  sortOrder: number;
};

export type SettlementRequestReceipt = {
  id: UUID;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedAt: ISODateTime;
};

export type SettlementRequestListItem = {
  id: UUID;
  courseId: UUID;
  courseName: string;
  instructor: MemberSummary | null;
  totalAmount: number;
  itemCount: number;
  status: SettlementRequestStatus;
  createdAt: ISODateTime;
  paidAt: ISODateTime | null;
};

export type SettlementRequestDetail = {
  id: UUID;
  workspaceId: UUID;
  courseId: UUID;
  courseName: string;
  instructor: MemberSummary | null;
  bankNameSnapshot: string;
  accountNumberSnapshot: string;
  accountHolderSnapshot: string;
  memo: string;
  totalAmount: number;
  status: SettlementRequestStatus;
  items: SettlementRequestItem[];
  receipts: SettlementRequestReceipt[];
  createdAt: ISODateTime;
  paidAt: ISODateTime | null;
  paidBy: MemberSummary | null;
};
