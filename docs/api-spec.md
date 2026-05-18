# DURE Page API Specification

이 문서는 `prd.md`, `architecture.md`, `context.md`, Supabase migration을 기준으로 DURE MVP의 화면별 데이터 계약을 정의한다. 개발 담당 범위가 프론트엔드/백엔드 계층이 아니라 페이지 단위로 나뉘므로, 이 명세는 특정 HTTP 방식보다 각 페이지가 호출해야 하는 `query`와 `action`의 입력, 출력, 권한, 오류를 고정한다.

구현자는 Next.js Server Action, Route Handler, Supabase RPC 중 적합한 방식을 선택할 수 있다. 단, 함수명, 입력 타입, 출력 타입, enum, 오류 코드는 이 문서를 기준으로 맞춘다.

이 문서는 페이지와 서버 계층 사이의 계약을 다룬다. 제품 범위와 수락 기준은 `prd.md`, 용어 기준은 `context.md`, 시스템 구조와 DB/RLS 설계는 `architecture.md`에서 관리한다.

## 0. Goal

여러 개발자가 페이지 단위로 병렬 개발하더라도 같은 도메인 용어, enum, 입력 payload, 응답 projection, 권한 규칙을 사용하게 만드는 것이 이 문서의 목표다. 각 페이지 담당자는 자기 화면의 UI 구현 전에 이 문서의 query/action 계약을 먼저 확정된 인터페이스로 본다.

## 1. 공통 원칙

### 1.0 구현 기준

- 페이지 구현자는 화면에서 Supabase 업무 테이블을 직접 조회하지 않고 이 문서의 `query`와 `action` 계약을 호출한다.
- 서버 구현자는 RLS를 최후 방어선으로 두되, 이 문서의 권한/범위 규칙을 서비스 함수에서 먼저 검증한다.
- 화면이 필요한 값을 DTO에 추가해야 할 때는 해당 페이지 계약을 먼저 수정하고, 임의 projection을 페이지 내부에서 새로 만들지 않는다.
- `can*` boolean은 화면 제어용 보조 값이다. 같은 권한은 action 실행 시 서버에서 다시 계산한다.
- 권한 필터가 복잡한 최근 활동, 자료 다운로드, 수업 참여자 범위 변경은 공통 서비스 함수를 통해서만 구현한다.

### 1.1 인증과 워크스페이스

- 모든 업무 데이터 요청은 Supabase Auth 로그인 세션이 필요하다.
- 모든 화면 계약은 `workspaceId`를 입력으로 받는다.
- 서버는 클라이언트가 전달한 `workspaceId`, `role`, `userId`, `memberId`를 신뢰하지 않고 현재 Auth 사용자와 `workspace_members`를 다시 확인한다.
- 현재 사용자의 활성 멤버십이 없으면 `AUTH_REQUIRED` 또는 `WORKSPACE_ACCESS_DENIED`를 반환한다.
- 참여자는 로그인 사용자가 아니며 API actor가 될 수 없다.

### 1.2 구현 형태

페이지 담당자는 아래 이름의 query/action 계약을 기준으로 구현한다.

```ts
type Query<TInput, TOutput> = (input: TInput) => Promise<ApiResult<TOutput>>;
type Action<TInput, TOutput> = (input: TInput) => Promise<ApiResult<TOutput>>;
```

파일 업로드/다운로드처럼 브라우저가 직접 HTTP URL을 필요로 하는 기능은 Route Handler로 구현한다.

| 기능 | 구현 방식 |
| --- | --- |
| 목록/상세 조회 | Server query 또는 server component data loader |
| 생성/수정/삭제/상태 변경 | Server Action 또는 Supabase RPC |
| 복수 테이블 트랜잭션 | Supabase RPC 또는 서버 서비스 함수 |
| 자료 업로드 URL 발급 | Route Handler |
| 자료 다운로드 URL 발급 | Route Handler |
| 초대 링크 수락 | Route Handler 또는 Server Action |
| cron | Route Handler |

### 1.3 공통 응답

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

type ApiError = {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  meta?: Record<string, unknown>;
};
```

### 1.4 공통 오류 코드

| 코드 | 의미 | HTTP 사용 시 권장 상태 |
| --- | --- | --- |
| `AUTH_REQUIRED` | 로그인 세션이 없음 | 401 |
| `WORKSPACE_ACCESS_DENIED` | 워크스페이스 멤버가 아니거나 비활성 상태 | 403 |
| `ROLE_FORBIDDEN` | 역할상 허용되지 않는 동작 | 403 |
| `SCOPE_FORBIDDEN` | 그룹/수업/자료 범위 권한이 없음 | 403 |
| `NOT_FOUND` | 접근 가능한 범위 안에서 대상이 없음 | 404 |
| `VALIDATION_FAILED` | 입력 검증 실패 | 400 |
| `CONFLICT` | 중복, 마지막 대표 운영자 보호, 이미 사용된 초대 등 상태 충돌 | 409 |
| `UPLOAD_POLICY_VIOLATION` | 파일 확장자, MIME, 크기 정책 위반 | 400 |
| `INVITE_EXPIRED` | 초대 링크 만료 | 410 |
| `INVITE_ALREADY_ACCEPTED` | 이미 사용된 초대 링크 | 409 |
| `INTERNAL_ERROR` | 예상하지 못한 서버 오류 | 500 |

### 1.5 공통 목록 입력

```ts
type PaginationInput = {
  page?: number;      // default 1
  pageSize?: number;  // default 20, max 100
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
};

type SortDirection = 'asc' | 'desc';
```

검색어는 앞뒤 공백을 제거한다. 빈 문자열은 필터 없음으로 처리한다.

### 1.6 공통 enum

DB enum 값을 API enum으로 그대로 사용한다.

```ts
type WorkspaceRole = 'owner_admin' | 'group_admin' | 'instructor';
type MemberStatus = 'active' | 'invited' | 'disabled' | 'removed';
type GroupStatus = 'active' | 'inactive';
type ParticipantStatus = 'active' | 'inactive' | 'deleted';
type ParticipantGroupStatus = 'active' | 'removed';
type CourseParticipantStatus = 'active' | 'excluded';
type CourseStatus = 'planned' | 'in_progress' | 'completed';
type CoursePublicVisibility = 'public' | 'hidden';
type SessionType = 'regular' | 'makeup' | 'special' | 'practice';
type SessionVisibilityStatus = 'visible' | 'hidden';
type SessionRollupStatus = 'included' | 'excluded';
type SessionProgressStatus = 'scheduled' | 'cancelled';
type MaterialUploadStatus = 'uploading' | 'uploaded' | 'failed';
type MaterialReviewStatus = 'pending' | 'reviewed';
type AttendanceStatus = 'present' | 'partial' | 'absent';
type MaterialVisibilityScope = 'all_course_groups' | 'selected_groups';
```

화면 표시 라벨은 각 페이지에서 아래처럼 변환한다.

| API 값 | 한국어 라벨 |
| --- | --- |
| `owner_admin` | 대표 운영자 |
| `group_admin` | 그룹 운영자 |
| `instructor` | 강사 |
| `planned` | 진행 전 |
| `in_progress` | 진행 중 |
| `completed` | 진행 완료 |
| `public` | 공개 |
| `hidden` | 숨김 |
| `pending` | 확인 미정 |
| `reviewed` | 확인됨 |
| `present` | 출석 |
| `partial` | 부분 출석 |
| `absent` | 결석 |
| `visible` | 표시 |
| `hidden` | 숨김 |
| `included` | 포함 |
| `excluded` | 제외 |
| `scheduled` | 예정 |
| `cancelled` | 취소 |

### 1.7 공통 ID와 시간

```ts
type UUID = string;
type ISODate = string;      // YYYY-MM-DD
type ISOTime = string;      // HH:mm:ss
type ISODateTime = string;  // ISO 8601 timestamptz
```

- 날짜와 시간은 워크스페이스 기준 시간대를 따른다.
- 기본 워크스페이스 시간대는 `Asia/Seoul`이다.
- DB의 `date`와 `time` 컬럼은 문자열로 직렬화한다.

## 2. 공통 DTO

### 2.1 Workspace

```ts
type WorkspaceSummary = {
  id: UUID;
  name: string;
  timezone: string;
  currentMember: MemberSummary;
};
```

### 2.2 Member

```ts
type MemberSummary = {
  id: UUID;
  email: string;
  displayName: string | null;
  role: WorkspaceRole;
  status: MemberStatus;
};

type MemberWithScope = MemberSummary & {
  groupIds: UUID[];
  courseIds: UUID[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
```

### 2.3 Group

```ts
type GroupSummary = {
  id: UUID;
  name: string;
  description: string | null;
  status: GroupStatus;
};

type GroupListItem = GroupSummary & {
  participantCount: number;
  courseCount: number;
  canEditDescription: boolean;
  canManageLifecycle: boolean;
};
```

### 2.4 Participant

```ts
type ParticipantSummary = {
  id: UUID;
  name: string;
  memo: string | null;
  status: ParticipantStatus;
};

type ParticipantListItem = ParticipantSummary & {
  groups: GroupSummary[];
  courseCount: number;
  canEditMaster: boolean;
  canRemoveFromAccessibleGroups: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
```

### 2.5 Course

```ts
type CourseSummary = {
  id: UUID;
  name: string;
  status: CourseStatus;
  startsOn: ISODate | null;
  endsOn: ISODate | null;
  cardColor: string | null;
  bannerUrl: string | null;
};

type InstructorSummary = {
  id: UUID;
  email: string;
  displayName: string | null;
  status: MemberStatus;
};

type CourseListItem = CourseSummary & {
  groups: GroupSummary[];
  instructor: InstructorSummary | null;
  participantCount: number;
  sessionCount: number;
  canManageFullCourse: boolean;
  canManageScopedParticipants: boolean;
};
```

### 2.6 Session

```ts
type CourseSessionSummary = {
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
```

### 2.7 Material

```ts
type MaterialListItem = {
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
```

### 2.8 Attendance

```ts
type AttendanceRecordDto = {
  id: UUID;
  sessionId: UUID;
  participantId: UUID;
  participantName: string;
  status: AttendanceStatus;
  note: string | null;
  updatedBy: MemberSummary | null;
  updatedAt: ISODateTime;
};
```

## 3. 공통 Actions

### 3.1 현재 워크스페이스 컨텍스트

```ts
type GetWorkspaceContextInput = {
  workspaceId: UUID;
};

type GetWorkspaceContextOutput = {
  workspace: WorkspaceSummary;
  accessibleGroups: GroupSummary[];
  capabilities: {
    canManageMembers: boolean;
    canCreateGroups: boolean;
    canCreateCourses: boolean;
    canCreateParticipants: boolean;
    canViewGeneralSchedule: boolean;
    canViewRecentActivity: boolean;
  };
};
```

계약명: `getWorkspaceContext`

권한:

- 활성 `workspace_members`가 필요하다.
- 강사는 `accessibleGroups`를 빈 배열로 받는다.

### 3.2 선택 후보 조회

페이지 폼에서 공통으로 사용하는 후보 데이터다.

```ts
type GetWorkspaceOptionsInput = {
  workspaceId: UUID;
  includeInactiveGroups?: boolean;
  includeInvitedMembers?: boolean;
};

type GetWorkspaceOptionsOutput = {
  groups: GroupSummary[];
  instructors: InstructorSummary[];
  ownerAdmins: MemberSummary[];
  groupAdmins: MemberSummary[];
};
```

계약명: `getWorkspaceOptions`

권한:

- 대표 운영자와 그룹 운영자는 접근 가능한 그룹과 강사 후보를 볼 수 있다.
- 강사는 호출하지 않는다.

## 4. 홈

운영자용 홈은 운영 중인 수업 카드 목록과 수업 상세 진입을 제공한다.

### 4.1 홈 데이터 조회

```ts
type GetDashboardHomeInput = {
  workspaceId: UUID;
  filters?: {
    status?: CourseStatus[];
    groupId?: UUID;
    search?: string;
  };
};

type GetDashboardHomeOutput = {
  courses: Array<CourseListItem & {
    nextSession: CourseSessionSummary | null;
    pendingMaterialCount: number;
  }>;
};
```

계약명: `getDashboardHome`

권한:

- 대표 운영자는 전체 수업을 본다.
- 그룹 운영자는 접근 그룹과 연결된 수업만 본다.
- 강사는 이 화면을 사용하지 않는다.

빈 상태:

- 수업이 없으면 `courses: []`.

## 5. 일정 관리

일정 관리는 수업 회차와 일반 일정을 월간 캘린더로 표시한다. 강사는 이 화면을 사용하지 않는다.

### 5.1 월간 일정 조회

```ts
type CalendarItem =
  | {
      kind: 'course_session';
      session: CourseSessionSummary;
      instructor: InstructorSummary | null;
      groups: GroupSummary[];
      canUpdateSessionDisplay: boolean;
    }
  | {
      kind: 'general_schedule_item';
      item: {
        id: UUID;
        title: string;
        date: ISODate;
        startsAt: ISOTime | null;
        endsAt: ISOTime | null;
        description: string | null;
        color: string | null;
        groups: GroupSummary[];
        canEdit: boolean;
        canDelete: boolean;
      };
    };

type GetCalendarMonthInput = {
  workspaceId: UUID;
  month: string; // YYYY-MM
  groupId?: UUID;
};

type GetCalendarMonthOutput = {
  timezone: string;
  items: CalendarItem[];
};
```

계약명: `getCalendarMonth`

권한:

- 대표 운영자는 전체 회차와 일반 일정을 본다.
- 그룹 운영자는 접근 그룹과 연결된 회차, 공개 그룹에 접근 가능한 일반 일정만 본다.
- 강사는 호출할 수 없다.

### 5.2 일반 일정 생성/수정/삭제

```ts
type UpsertGeneralScheduleItemInput = {
  workspaceId: UUID;
  id?: UUID;
  title: string;
  date: ISODate;
  startsAt?: ISOTime | null;
  endsAt?: ISOTime | null;
  description?: string | null;
  color?: string | null;
  groupIds: UUID[];
};

type GeneralScheduleItemOutput = {
  id: UUID;
};

type DeleteGeneralScheduleItemInput = {
  workspaceId: UUID;
  id: UUID;
};
```

계약명:

- `upsertGeneralScheduleItem`
- `deleteGeneralScheduleItem`

검증:

- `title`은 공백 제거 후 1자 이상이다.
- `groupIds`는 1개 이상이다.
- `endsAt`이 있으면 `startsAt`도 있어야 하며 `endsAt > startsAt`이어야 한다.

권한:

- 대표 운영자는 모든 그룹을 지정할 수 있다.
- 그룹 운영자는 자기 접근 그룹만 지정할 수 있다.
- 강사는 호출할 수 없다.

### 5.3 회차 표시/집계/진행 상태 변경

```ts
type UpdateSessionStatusInput = {
  workspaceId: UUID;
  sessionId: UUID;
  visibilityStatus?: SessionVisibilityStatus;
  rollupStatus?: SessionRollupStatus;
  progressStatus?: SessionProgressStatus;
};
```

계약명: `updateSessionStatus`

권한:

- 대표 운영자 또는 수업 전체 수정 가능한 그룹 운영자만 호출할 수 있다.
- 강사는 호출할 수 없다.

## 6. 사용자 초대/권한 설정

대표 운영자 전용 화면이다.

### 6.1 멤버 목록 조회

```ts
type GetMembersPageInput = {
  workspaceId: UUID;
  role?: WorkspaceRole;
  status?: MemberStatus;
  search?: string;
} & PaginationInput;

type GetMembersPageOutput = {
  members: MemberWithScope[];
  pageInfo: PageInfo;
};
```

계약명: `getMembersPage`

권한:

- 대표 운영자만 호출할 수 있다.

### 6.2 초대 링크 생성

```ts
type CreateInviteInput = {
  workspaceId: UUID;
  email: string;
  displayName?: string | null;
  role: WorkspaceRole;
  groupIds?: UUID[];
  courseIds?: UUID[];
};

type CreateInviteOutput = {
  inviteId: UUID;
  memberId: UUID;
  inviteUrl: string;
  expiresAt: ISODateTime;
};
```

계약명: `createInvite`

검증:

- `email`은 이메일 형식이어야 한다.
- `role = group_admin`이면 `groupIds`가 1개 이상이어야 한다.
- `role = instructor`이면 `courseIds`는 선택값이다.
- `role = owner_admin`이면 `groupIds`, `courseIds`는 무시한다.
- 초대 만료 기본값은 생성 시점부터 7일이다.

처리:

- `workspace_members`에 `status = invited` placeholder를 만든다.
- 그룹 운영자는 `workspace_member_groups`를 미리 연결한다.
- 강사 초대는 `invite_courses`를 만들고, 필요한 경우 수업의 `instructor_member_id`에 placeholder member를 배정할 수 있다.
- 초대 토큰 원문은 저장하지 않고 hash만 저장한다.

### 6.3 멤버 권한 변경

```ts
type UpdateMemberInput = {
  workspaceId: UUID;
  memberId: UUID;
  displayName?: string | null;
  role?: WorkspaceRole;
  status?: MemberStatus;
  groupIds?: UUID[];
  courseIds?: UUID[];
};

type UpdateMemberOutput = {
  member: MemberWithScope;
};
```

계약명: `updateMember`

권한:

- 대표 운영자만 호출할 수 있다.
- 마지막 활성 대표 운영자는 역할 변경, 비활성화, 제거할 수 없다.

### 6.4 초대 수락

```ts
type AcceptInviteInput = {
  token: string;
};

type AcceptInviteOutput = {
  workspaceId: UUID;
  member: MemberWithScope;
};
```

계약명: `acceptInvite`

권한:

- 로그인 세션이 필요하다.
- token hash가 일치하고 `accepted_at`이 없으며 `expires_at`이 지나지 않아야 한다.
- 수락 시 기존 placeholder 멤버십의 `user_id`, `status`, `accepted_at`을 갱신한다.

## 7. 그룹 관리

### 7.1 그룹 목록 조회

```ts
type GetGroupsPageInput = {
  workspaceId: UUID;
  search?: string;
  status?: GroupStatus;
} & PaginationInput;

type GetGroupsPageOutput = {
  groups: GroupListItem[];
  pageInfo: PageInfo;
};
```

계약명: `getGroupsPage`

권한:

- 대표 운영자는 전체 그룹을 본다.
- 그룹 운영자는 접근 그룹만 본다.
- 강사는 호출할 수 없다.

### 7.2 그룹 생성/수정

```ts
type UpsertGroupInput = {
  workspaceId: UUID;
  id?: UUID;
  name: string;
  description?: string | null;
  status: GroupStatus;
};

type UpsertGroupOutput = {
  group: GroupListItem;
};
```

계약명: `upsertGroup`

권한:

- 생성, 이름 변경, 상태 변경은 대표 운영자만 가능하다.
- 그룹 운영자는 접근 그룹의 `description`만 수정할 수 있다.

검증:

- `name`은 공백 제거 후 1자 이상이다.
- 비활성 그룹은 목록에 남고 새 수업 생성 후보에서는 구분 표시한다.

### 7.3 그룹 삭제

```ts
type DeleteGroupInput = {
  workspaceId: UUID;
  groupId: UUID;
};
```

계약명: `deleteGroup`

처리:

- 물리 삭제보다 `deleted_at` 또는 삭제 상태에 준하는 소프트 삭제를 우선한다.
- 기존 수업에는 `course_groups.group_name_snapshot`이 남아야 한다.

권한:

- 대표 운영자만 가능하다.

## 8. 수업 관리

### 8.1 수업 목록 조회

```ts
type GetCoursesPageInput = {
  workspaceId: UUID;
  search?: string;
  groupId?: UUID;
  status?: CourseStatus;
} & PaginationInput;

type GetCoursesPageOutput = {
  courses: CourseListItem[];
  pageInfo: PageInfo;
};
```

계약명: `getCoursesPage`

권한:

- 대표 운영자는 전체 수업을 본다.
- 그룹 운영자는 접근 그룹과 연결된 수업을 본다.
- 강사는 운영자 수업 관리 화면을 사용하지 않는다.

### 8.2 수업 생성 폼 후보 조회

```ts
type GetCourseFormOptionsInput = {
  workspaceId: UUID;
  groupIds?: UUID[];
};

type CourseParticipantCandidate = ParticipantSummary & {
  groups: GroupSummary[];
  defaultAssignmentGroupIds: UUID[];
};

type GetCourseFormOptionsOutput = {
  groups: GroupSummary[];
  instructors: InstructorSummary[];
  participantCandidates: CourseParticipantCandidate[];
};
```

계약명: `getCourseFormOptions`

규칙:

- `groupIds`가 없으면 `participantCandidates`는 빈 배열이다.
- `groupIds`가 있으면 해당 그룹에 속한 활성 참여자만 후보로 반환한다.
- 같은 참여자가 여러 그룹에 속해도 한 번만 반환한다.

### 8.3 수업 생성

```ts
type CreateCourseInput = {
  workspaceId: UUID;
  name: string;
  status: CourseStatus;
  groupIds: UUID[];
  instructorMemberId?: UUID | null;
  recurrence: {
    startsOn: ISODate;
    endsOn?: ISODate | null;
    sessionCount?: number | null;
    repeatWeekdays: number[]; // 0 Sunday ... 6 Saturday
    startsAt: ISOTime;
    endsAt: ISOTime;
  };
  participantAssignments: Array<{
    participantId: UUID;
    assignmentGroupIds: UUID[];
  }>;
  cardColor?: string | null;
  bannerUrl?: string | null;
};

type CreateCourseOutput = {
  course: CourseListItem;
  sessions: CourseSessionSummary[];
};
```

계약명: `createCourse`

검증:

- `name`은 공백 제거 후 1자 이상이다.
- `groupIds`는 1개 이상이다.
- `recurrence.endsOn`과 `recurrence.sessionCount`는 둘 중 하나만 입력한다.
- `repeatWeekdays`는 1개 이상이며 0부터 6 사이 값만 허용한다.
- `endsAt > startsAt`이어야 한다.
- 각 `assignmentGroupIds`는 `groupIds`의 부분집합이며 1개 이상이다.

처리:

- `courses`, `course_recurrence_rules`, `course_groups`, `course_sessions`, `course_participants`, `course_participant_groups`를 하나의 트랜잭션으로 만든다.
- 회차는 날짜와 시작 시간 오름차순으로 `sessionNo`를 부여한다.
- 단발성 수업은 `sessionCount = 1`로 처리한다.

권한:

- 대표 운영자는 모든 활성 그룹으로 생성 가능하다.
- 그룹 운영자는 자기 접근 그룹만 연결해 생성 가능하다.
- 강사는 호출할 수 없다.

### 8.4 수업 기본 정보 수정

```ts
type UpdateCourseInput = {
  workspaceId: UUID;
  courseId: UUID;
  name?: string;
  status?: CourseStatus;
  instructorMemberId?: UUID | null;
  groupIds?: UUID[];
  cardColor?: string | null;
  bannerUrl?: string | null;
};

type UpdateCourseOutput = {
  course: CourseListItem;
};
```

계약명: `updateCourse`

권한:

- 대표 운영자는 전체 수정 가능하다.
- 그룹 운영자는 수업의 모든 연결 그룹이 자기 접근 그룹 안에 있을 때만 전체 수정 가능하다.
- 접근 권한 없는 그룹이 포함된 수업에서는 이 action을 호출하지 않고 `updateCourseParticipantAssignment`만 사용한다.
- 강사는 호출할 수 없다.

### 8.5 수업 참여자 배정 변경

```ts
type UpdateCourseParticipantAssignmentInput = {
  workspaceId: UUID;
  courseId: UUID;
  participantId: UUID;
  assignmentGroupIds: UUID[];
  status?: CourseParticipantStatus;
};

type UpdateCourseParticipantAssignmentOutput = {
  courseParticipantId: UUID;
  participantId: UUID;
  assignmentGroupIds: UUID[];
  status: CourseParticipantStatus;
};
```

계약명: `updateCourseParticipantAssignment`

규칙:

- `assignmentGroupIds`는 해당 수업의 연결 그룹 중 하나 이상이어야 한다.
- 대표 운영자는 전체 `assignmentGroupIds`를 교체할 수 있다.
- 그룹 운영자는 자기 접근 그룹만 추가/제거할 수 있다.
- 그룹 운영자가 자기 그룹을 제거한 뒤 남는 `assignmentGroupIds`가 없으면 해당 배정은 `excluded`로 전환한다.

## 9. 참여자 관리

### 9.1 참여자 목록 조회

```ts
type GetParticipantsPageInput = {
  workspaceId: UUID;
  search?: string;
  groupId?: UUID;
  status?: ParticipantStatus;
} & PaginationInput;

type GetParticipantsPageOutput = {
  participants: ParticipantListItem[];
  pageInfo: PageInfo;
};
```

계약명: `getParticipantsPage`

권한:

- 대표 운영자는 전체 참여자를 본다.
- 그룹 운영자는 접근 그룹 참여자와 접근 가능한 수업에 배정된 참여자를 본다.
- 강사는 호출할 수 없다.

### 9.2 참여자 생성/수정

```ts
type UpsertParticipantInput = {
  workspaceId: UUID;
  id?: UUID;
  name: string;
  memo?: string | null;
  status?: ParticipantStatus;
  groupIds?: UUID[];
};

type UpsertParticipantOutput = {
  participant: ParticipantListItem;
};
```

계약명: `upsertParticipant`

검증:

- `name`은 공백 제거 후 1자 이상이다.
- 생성 시 `groupIds`는 선택값이지만, 그룹 운영자가 생성하는 경우 1개 이상이며 모두 자기 접근 그룹이어야 한다.
- 같은 그룹 안에 같은 이름이 있으면 저장 이름 뒤에 `-1`, `-2` 순번을 붙인다.

권한:

- 대표 운영자는 마스터 전체 수정 가능하다.
- 그룹 운영자는 새 참여자를 자기 접근 그룹에 배정하는 조건으로 생성 가능하다.
- 그룹 운영자는 자신이 생성했고 자기 접근 그룹에만 속한 참여자의 `name`, `memo`만 수정 가능하다.
- 강사는 호출할 수 없다.

### 9.3 참여자 그룹 배정 변경

```ts
type UpdateParticipantGroupsInput = {
  workspaceId: UUID;
  participantId: UUID;
  groupIds: UUID[];
};
```

계약명: `updateParticipantGroups`

권한:

- 대표 운영자는 전체 그룹 배정을 교체할 수 있다.
- 그룹 운영자는 자기 접근 그룹만 추가/제거할 수 있다.
- 강사는 호출할 수 없다.

### 9.4 참여자 삭제

```ts
type DeleteParticipantInput = {
  workspaceId: UUID;
  participantId: UUID;
};
```

계약명: `deleteParticipant`

처리:

- `participants.status = deleted` 및 `deleted_at` 설정을 기본으로 한다.
- 기존 출석 기록과 수업 배정 스냅샷은 유지한다.
- 이후 회차 출석 대상에서는 제외한다.

권한:

- 대표 운영자만 가능하다.

## 10. 수업 상세 홈

MVP에서는 수업 대표 영역과 카드 색상 설정만 제공한다.

### 10.1 수업 홈 조회

```ts
type GetCourseHomeInput = {
  workspaceId: UUID;
  courseId: UUID;
};

type GetCourseHomeOutput = {
  course: CourseSummary & {
    groups: GroupSummary[];
    instructor: InstructorSummary | null;
    canUpdateVisuals: boolean;
  };
};
```

계약명: `getCourseHome`

권한:

- 대표 운영자, 접근 그룹 운영자, 담당 강사가 접근 가능하다.

### 10.2 수업 카드/배너 수정

```ts
type UpdateCourseVisualsInput = {
  workspaceId: UUID;
  courseId: UUID;
  cardColor?: string | null;
  bannerUrl?: string | null;
};
```

계약명: `updateCourseVisuals`

권한:

- 대표 운영자 또는 수업 전체 수정 가능한 그룹 운영자만 가능하다.
- 강사는 호출할 수 없다.

## 11. 수업 자료

### 11.1 자료 목록 조회

```ts
type GetCourseMaterialsInput = {
  workspaceId: UUID;
  courseId: UUID;
  reviewStatus?: MaterialReviewStatus;
};

type GetCourseMaterialsOutput = {
  course: CourseSummary & {
    groups: GroupSummary[];
    instructor: InstructorSummary | null;
  };
  materials: MaterialListItem[];
  uploadPolicy: {
    maxSizeBytes: 52428800;
    allowedExtensions: string[];
    allowedMimeTypes: string[];
  };
  canCreateMaterial: boolean;
};
```

계약명: `getCourseMaterials`

권한:

- 대표 운영자는 전체 자료를 본다.
- 그룹 운영자는 자료 공개 범위가 자기 접근 그룹과 교차하는 자료만 본다.
- 담당 강사는 담당 수업 자료를 본다.

### 11.2 자료 업로드 준비

```ts
type PrepareMaterialUploadInput = {
  workspaceId: UUID;
  courseId: UUID;
  title: string;
  description?: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  visibilityScope: MaterialVisibilityScope;
  visibleGroupIds?: UUID[];
};

type PrepareMaterialUploadOutput = {
  materialId: UUID;
  storagePath: string;
  signedUploadUrl: string;
  expiresAt: ISODateTime;
};
```

계약명: `prepareMaterialUpload`

Route Handler 후보: `POST /api/materials/upload-url`

검증:

- 파일당 최대 크기는 50MB다.
- 허용 확장자는 `pdf`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`, `jpg`, `jpeg`, `png`, `txt`, `zip`이다.
- 실행 파일과 스크립트 파일은 거부한다.
- `visibilityScope = selected_groups`이면 `visibleGroupIds`가 1개 이상이어야 한다.
- 공개 그룹은 해당 수업 연결 그룹이어야 한다.

처리:

- `materials`를 `upload_status = uploading`, `review_status = pending`으로 먼저 만든다.
- `visibilityScope = selected_groups`이면 signed upload URL을 반환하기 전에 `material_groups`를 함께 저장한다.
- storage path 형식은 `workspaces/{workspace_id}/courses/{course_id}/materials/{material_id}/{file_id}-{safe_filename}`이다.

### 11.3 자료 업로드 완료 확정

```ts
type CompleteMaterialUploadInput = {
  workspaceId: UUID;
  materialId: UUID;
};

type CompleteMaterialUploadOutput = {
  material: MaterialListItem;
};
```

계약명: `completeMaterialUpload`

권한:

- 자료를 수정할 수 있는 사용자만 호출할 수 있다.
- `materialId`가 가리키는 자료의 `storagePath`에 실제 파일이 존재해야 한다.

처리:

- 실제 업로드 여부를 Storage에서 확인한 뒤 `upload_status = uploaded`로 변경한다.

### 11.4 자료 메타데이터 수정

```ts
type UpdateMaterialInput = {
  workspaceId: UUID;
  materialId: UUID;
  title?: string;
  description?: string | null;
  visibilityScope?: MaterialVisibilityScope;
  visibleGroupIds?: UUID[];
};

type UpdateMaterialOutput = {
  material: MaterialListItem;
};
```

계약명: `updateMaterial`

처리:

- 제목, 설명, 파일, 공개 범위가 바뀌면 `review_status = pending`으로 되돌린다.
- `visibilityScope` 변경뿐 아니라 `visibleGroupIds` 추가, 제거, 교체도 공개 범위 변경으로 본다.

권한:

- 대표 운영자, 수업 전체 수정 가능한 그룹 운영자, 업로더가 수정 가능하다.
- 그룹 운영자는 자기 접근 그룹이 공개 범위에 포함된 자료만 수정할 수 있다.
- 담당 강사는 담당 수업에서 자신이 업로드한 자료를 수정할 수 있다.

### 11.5 자료 파일 교체

```ts
type ReplaceMaterialFileInput = {
  workspaceId: UUID;
  materialId: UUID;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

type ReplaceMaterialFileOutput = {
  storagePath: string;
  signedUploadUrl: string;
  expiresAt: ISODateTime;
};
```

계약명: `replaceMaterialFile`

처리:

- 새 storage path를 발급하고 `upload_status = uploading`, `review_status = pending`으로 변경한다.
- 업로드 완료 후 `completeMaterialUpload`를 호출한다.

### 11.6 자료 확인 상태 변경

```ts
type UpdateMaterialReviewStatusInput = {
  workspaceId: UUID;
  materialId: UUID;
  reviewStatus: MaterialReviewStatus;
};
```

계약명: `updateMaterialReviewStatus`

권한:

- 대표 운영자 가능.
- 자료 공개 그룹과 자기 접근 그룹이 교차하는 그룹 운영자 가능.
- 강사는 불가.

### 11.7 자료 다운로드 URL 발급

```ts
type GetMaterialDownloadUrlInput = {
  workspaceId: UUID;
  materialId: UUID;
};

type GetMaterialDownloadUrlOutput = {
  signedDownloadUrl: string;
  expiresAt: ISODateTime;
  originalFilename: string | null;
};
```

계약명: `getMaterialDownloadUrl`

Route Handler 후보: `GET /api/materials/[materialId]/download`

권한:

- `canDownload = true`인 사용자만 가능하다.

## 12. 수업 상세 - 참여자 현황

### 12.1 참여자 현황 조회

```ts
type GetCourseParticipantsStatusInput = {
  workspaceId: UUID;
  courseId: UUID;
  search?: string;
  participantStatus?: CourseParticipantStatus;
  attendanceStatus?: AttendanceStatus;
  from?: ISODate;
  to?: ISODate;
} & PaginationInput;

type CourseParticipantStatusItem = {
  courseParticipantId: UUID | null;
  participant: ParticipantSummary;
  assignmentGroups: GroupSummary[];
  assignmentStatus: CourseParticipantStatus;
  presentCount: number;
  partialCount: number;
  absentCount: number;
  attendanceRate: number | null;
  latestNote: string | null;
  canEditAssignment: boolean;
};

type GetCourseParticipantsStatusOutput = {
  course: CourseSummary;
  summary: {
    attendanceRate: number | null;
    partialCount: number;
    absentCount: number;
    countedSessionCount: number;
  };
  participants: CourseParticipantStatusItem[];
};
```

계약명: `getCourseParticipantsStatus`

명단 규칙:

- 명단은 수업의 **현재 연결된 활성 그룹(`groups.deleted_at IS NULL`)의 활성 멤버**(`participant_groups.status='active'`, `participants.deleted_at IS NULL`)에서 자동으로 파생된다.
- `course_participants.status='excluded'`로 명시 제외된 참여자는 `assignmentStatus='excluded'`로 표시된다(목록에서 사라지지 않는다 — 복구할 수 있도록 유지).
- `courseParticipantId`는 명시 제외/활성 기록이 있는 경우만 UUID, 없으면 `null`.
- 응답에 별도의 `eligibleParticipants` 필드는 없다(그룹 멤버는 자동 포함이므로 후보 개념이 무의미).

집계 규칙:

- 출석률은 출석 수를 기록 대상 회차 수로 나눈 값이다.
- 미입력 회차는 계산에서 제외한다.
- `rollup_status = excluded`인 회차와 `progress_status = cancelled`인 회차는 계산에서 제외한다.
- `partial`은 부분 출석으로 별도 합산한다.

### 12.2 수업 참여자 제외

```ts
type ExcludeCourseParticipantInput = {
  workspaceId: UUID;
  courseId: UUID;
  participantId: UUID;
};
```

계약명: `excludeCourseParticipant`

처리:

- 대상 `course_participants` 행이 있으면 `status='excluded'`로 업데이트, 없으면 새 행을 `status='excluded'`로 insert한다.
- 명시 제외된 참여자는 강사 출석부와 운영자 명단의 카운트(active) 대상에서 빠지지만, 명단 화면에는 `excluded` 표시로 남아 복구할 수 있다.
- 강사는 호출할 수 없다.

### 12.3 수업 참여자 복구

```ts
type ReincludeCourseParticipantInput = {
  workspaceId: UUID;
  courseId: UUID;
  participantId: UUID;
};
```

계약명: `reincludeCourseParticipant`

처리:

- 대상 `course_participants` 행이 있고 `status='excluded'`이면 `status='active'`로 되돌린다.
- 명시 제외 기록이 없으면 그대로 통과(이미 그룹 멤버십으로 활성).
- 강사는 호출할 수 없다.

## 13. 강사 콘솔 - 수업 홈

### 13.1 강사 수업 홈 조회

```ts
type GetInstructorCourseHomeInput = {
  workspaceId: UUID;
  courseId: UUID;
  today?: ISODate;
};

type GetInstructorCourseHomeOutput = {
  course: CourseSummary;
  todaySessions: Array<CourseSessionSummary & {
    attendanceSavedCount: number;
    attendanceTargetCount: number;
    classMemo: string | null;
  }>;
  materialCount: number;
  pendingMaterialCount: number;
};
```

계약명: `getInstructorCourseHome`

권한:

- 담당 강사만 호출할 수 있다.
- 운영자 화면에서는 `getCourseHome`을 사용한다.
- 일반 일정은 반환하지 않는다.

## 14. 강사 콘솔 - 수업 자료

강사 콘솔 자료 화면은 `getCourseMaterials`, `prepareMaterialUpload`, `completeMaterialUpload`, `updateMaterial`, `replaceMaterialFile`, `getMaterialDownloadUrl` 계약을 그대로 사용한다.

추가 제한:

- 강사는 담당 수업만 접근 가능하다.
- 강사는 `updateMaterialReviewStatus`를 호출할 수 없다.
- 강사가 업로드, 수정, 교체한 자료는 항상 `review_status = pending`이다.

## 15. 강사 콘솔 - 출석부

### 15.1 출석부 조회

```ts
type GetAttendanceBookInput = {
  workspaceId: UUID;
  courseId: UUID;
  sessionId?: UUID;
};

type AttendanceTarget = {
  participantId: UUID;
  participantName: string;
  assignmentGroups: GroupSummary[];
  record: AttendanceRecordDto | null;
};

type GetAttendanceBookOutput = {
  course: CourseSummary;
  sessions: CourseSessionSummary[];
  selectedSession: CourseSessionSummary | null;
  targets: AttendanceTarget[];
  classMemo: {
    id: UUID | null;
    content: string;
    updatedBy: MemberSummary | null;
    updatedAt: ISODateTime | null;
  };
  canSaveAttendance: boolean;
  canSaveMemo: boolean;
};
```

계약명: `getAttendanceBook`

규칙:

- `sessionId`가 없으면 오늘 회차가 있으면 오늘 회차, 없으면 가장 가까운 예정 회차를 선택한다.
- 삭제 또는 제외된 참여자는 이후 회차 출석 대상에서 제외한다.
- 기존 출석 기록은 계속 조회 가능하다.

권한:

- 담당 강사는 담당 수업만 접근 가능하다.
- 대표 운영자와 접근 가능한 그룹 운영자도 운영자 화면에서 같은 계약을 사용할 수 있다.

### 15.2 출석 저장

```ts
type SaveAttendanceInput = {
  workspaceId: UUID;
  sessionId: UUID;
  records: Array<{
    participantId: UUID;
    status: AttendanceStatus;
    note?: string | null;
  }>;
};

type SaveAttendanceOutput = {
  records: AttendanceRecordDto[];
};
```

계약명: `saveAttendance`

검증:

- `records`는 1개 이상이다.
- 각 참여자는 해당 회차 수업의 활성 출석 대상이어야 한다.
- `status`는 `present`, `partial`, `absent` 중 하나다.

권한:

- 담당 강사 가능.
- 대표 운영자 가능.
- 접근 가능한 그룹 운영자는 자기 그룹 범위의 참여자 기록만 저장 가능하다.

처리:

- 같은 `sessionId`, `participantId` 조합은 upsert한다.
- `participant_name_snapshot`은 저장 시점 참여자 이름으로 기록한다.
- `updated_by`는 현재 멤버 ID다.
- 활동 로그를 남긴다.

### 15.3 수업 메모 저장

```ts
type SaveClassMemoInput = {
  workspaceId: UUID;
  sessionId: UUID;
  content: string;
};

type SaveClassMemoOutput = {
  id: UUID;
  content: string;
  updatedBy: MemberSummary;
  updatedAt: ISODateTime;
};
```

계약명: `saveClassMemo`

권한:

- 담당 강사 가능.
- 대표 운영자 가능.
- 접근 가능한 그룹 운영자 가능.

처리:

- 같은 `sessionId`에 대해 upsert한다.
- 활동 로그를 남긴다.

## 16. 헤더 최근 활동

### 16.1 최근 활동 조회

```ts
type ActivityTarget =
  | { type: 'course'; courseId: UUID; href: string }
  | { type: 'course_material'; courseId: UUID; materialId: UUID; href: string }
  | { type: 'attendance'; courseId: UUID; sessionId: UUID; href: string }
  | { type: 'class_memo'; courseId: UUID; sessionId: UUID; href: string }
  | { type: 'member'; memberId: UUID; href: string };

type ActivityItem = {
  id: UUID;
  eventType: string;
  title: string;
  description: string | null;
  actor: MemberSummary | null;
  target: ActivityTarget;
  createdAt: ISODateTime;
};

type GetRecentActivityInput = {
  workspaceId: UUID;
  limit?: number; // default 20, max 50
};

type GetRecentActivityOutput = {
  activities: ActivityItem[];
};
```

계약명: `getRecentActivity`

반환 대상:

- 강사가 자료를 업로드, 수정, 교체한 이벤트.
- 강사가 출석, 특이사항, 수업 메모를 수정한 이벤트.
- 오늘 진행되는 수업 회차.
- 새 운영자 또는 강사가 초대 링크로 가입/등록된 이벤트.

필터:

- 권한 있는 사용자에게만 보이는 이벤트를 반환한다.
- `activity_logs` 원본 테이블을 클라이언트에 그대로 노출하지 않는다. `getRecentActivity`는 이벤트별 target을 해석한 뒤 `can_access_course`, `can_access_material`, 멤버 관리 권한 등 대상별 권한을 다시 확인해 DTO만 반환한다.
- 숨김 회차, 기록 집계 제외 회차, 취소 회차, 일반 일정은 오늘 진행 수업 회차 이벤트에서 제외한다.
- 오늘 기준은 워크스페이스 시간대를 따른다.
- 읽음/안읽음 상태는 MVP에서 제공하지 않는다.

## 17. Cron

### 17.1 수업 상태 자동 완료

Route Handler 후보: `POST /api/cron/complete-courses`

```ts
type CompleteCoursesCronOutput = {
  completedCourseIds: UUID[];
  completedCount: number;
};
```

인증:

- `CRON_SECRET` 기반 서버 간 호출만 허용한다.

처리:

- 마지막 유효 회차의 종료 시간이 지난 수업을 `completed`로 전환한다.
- 유효 회차는 `progress_status != cancelled`인 회차다.

## 18. 공개 수업 카탈로그

공개 카탈로그는 비로그인 방문자가 볼 수 있는 수업 예시 목록이다. 업무 테이블을 직접 노출하지 않고 `PublicCourse*` DTO만 반환한다.

### 18.1 공개 카탈로그 조회

Query: `getPublicCourseCatalog`

```ts
type PublicCourseSummary = {
  workspace: { id: UUID; name: string };
  id: UUID;
  name: string;
  status: CourseStatus;
  publicVisibility: CoursePublicVisibility;
  startsOn: ISODate | null;
  endsOn: ISODate | null;
  cardColor: string | null;
  bannerUrl: string | null;
  groupNames: string[];
  sessionCount: number;
  materialCount: number;
};

type PublicCourseCatalog = {
  workspaces: Array<{
    id: UUID;
    name: string;
    courses: PublicCourseSummary[];
  }>;
};
```

규칙:

- 인증이 필요 없다.
- `courses.public_visibility = 'public'`인 수업만 포함한다.
- 마을 섹션은 `workspace.name asc`로 정렬한다.
- 섹션 내 수업은 `in_progress`, `planned`, `completed`, `updated_at desc`, `created_at desc` 순으로 정렬한다.
- 공개 회차 수는 `course_sessions.visibility_status = 'visible'`인 회차만 센다.
- 공개 자료 수는 `materials.upload_status = 'uploaded'`인 자료만 센다.

### 18.2 공개 수업 상세 조회

Query: `getPublicCourseDetail(courseId: UUID)`

```ts
type PublicCourseSession = {
  sessionNo: number;
  date: ISODate;
  startsAt: ISOTime;
  endsAt: ISOTime;
  type: SessionType;
  progressStatus: SessionProgressStatus;
};

type PublicCourseMaterial = {
  title: string;
  description: string | null;
};

type PublicCourseDetail = PublicCourseSummary & {
  sessions: PublicCourseSession[];
  materials: PublicCourseMaterial[];
};
```

규칙:

- 인증이 필요 없다.
- 숨김 수업, 누락 수업, 접근 불가 수업은 모두 `NOT_FOUND`로 반환해 숨김 수업 존재 여부를 노출하지 않는다.
- 회차는 `date asc`, `starts_at asc`, `session_no asc`로 정렬한다.
- 자료는 `created_at desc`로 정렬한다.
- 자료 다운로드 URL, `storage_path`, `original_filename`, MIME type, 파일 크기, 업로더, 멤버 이메일, 참여자, 출석, 수업 메모는 반환하지 않는다.

### 18.3 운영자 공개 preview 조회

Query: `getCoursePublicPreview({ workspaceId, courseId })`

반환 타입은 `PublicCourseDetail`과 같다.

권한:

- 로그인한 활성 워크스페이스 멤버만 호출할 수 있다.
- owner_admin은 전체 수업 preview를 볼 수 있다.
- group_admin은 접근 그룹과 연결된 수업 preview를 볼 수 있다.
- instructor는 담당 수업 preview를 볼 수 있다.
- 숨김 수업도 preview에는 표시한다.

### 18.4 수업 공개 상태 변경

Action: `updateCoursePublicVisibility`

```ts
type UpdateCoursePublicVisibilityInput = {
  workspaceId: UUID;
  courseId: UUID;
  publicVisibility: CoursePublicVisibility;
};

type UpdateCoursePublicVisibilityOutput = {
  publicVisibility: CoursePublicVisibility;
};
```

권한:

- owner_admin은 변경할 수 있다.
- group_admin은 해당 수업의 모든 연결 그룹이 자기 접근 그룹 안에 있을 때만 변경할 수 있다.
- instructor는 변경할 수 없다.

## 19. 페이지별 담당자 체크리스트

각 페이지 담당자는 구현 전에 아래 항목을 확인한다.

- 화면에서 쓰는 query/action 이름이 이 문서와 같은가.
- 입력 타입에 `workspaceId`가 포함되어 있는가.
- 화면 표시 라벨은 API enum 값을 직접 바꾸지 않고 매핑하는가.
- 권한에 따라 버튼 숨김을 하더라도 서버 action에서 권한을 다시 확인하는가.
- 목록 검색어와 필터의 빈 값 처리가 공통 규칙과 같은가.
- `ApiResult` 오류를 화면에서 공통 처리할 수 있는가.
- 참여자와 멤버를 혼동하지 않았는가.
- 강사 화면에 일반 일정이나 운영자 전용 데이터가 섞이지 않았는가.
- 자료 업로드는 준비, 브라우저 업로드, 완료 확정의 3단계 흐름을 따르는가.
- 삭제는 기록 보존 정책을 따르며 기존 snapshot 필드를 훼손하지 않는가.

## 20. 구현 우선순위

페이지별 병렬 개발을 위해 다음 순서로 공통 계약을 먼저 구현한다.

1. `getWorkspaceContext`, `getWorkspaceOptions`
2. 그룹, 참여자 기본 목록과 생성/수정 action
3. 수업 생성 폼 후보, 수업 생성 action
4. 수업 목록, 홈, 상세 공통 조회
5. 자료 업로드/목록/다운로드 계약
6. 출석부와 수업 메모 계약
7. 초대/권한 설정 계약
8. 일정 관리와 최근 활동 계약

이 순서는 개발 순서를 강제하지 않는다. 다만 서로 다른 페이지가 같은 후보 데이터와 공통 DTO를 재사용하도록 하기 위한 기준이다.
