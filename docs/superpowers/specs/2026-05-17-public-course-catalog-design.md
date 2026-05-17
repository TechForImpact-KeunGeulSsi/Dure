# Public Course Catalog Design

## Context

DURE currently routes unauthenticated visitors from `/` to `/login`. The new goal is to make the first page useful to non-logged-in visitors by showing what each village has been running, while still protecting operational data. Operators should also be able to see exactly what their course will look like publicly and hide a course from the public catalog when needed.

In DURE terms, the user-facing "village" maps to `workspaces`. A course is a class/program inside a workspace. The public catalog shows courses grouped by workspace.

## Goals

- Let fully unauthenticated visitors browse public course examples from all villages.
- Show courses grouped by village on the root page (`/`).
- Let visitors open a course detail page for public course content.
- Require no extra summary-writing work from operators.
- Let authorized operators hide or show a course from public discovery.
- Show operators a public preview inside the existing operator course home.
- Reuse one public DTO for the public pages and the operator preview so the preview cannot drift from the real public view.

## Non-Goals

- No participant names, attendance records, special notes, or class memos are exposed.
- No material file download, signed URL, `storage_path`, or original filename is exposed.
- No instructor/operator email or internal member id is exposed.
- No material-level visibility toggle in this phase.
- No workspace/village-level visibility toggle in this phase.
- No public search/filter in the first implementation.
- No generated AI summary in this phase.

## Routes

### `/`

The root page becomes the public catalog instead of redirecting unauthenticated users to `/login`.

The page shows:

- Header with DURE identity.
- CTA to log in or go to workspaces for authenticated users.
- Village sections ordered by workspace name.
- Course cards inside each village section.
- Empty state when no public courses exist.

Course cards show:

- Course name.
- Status.
- Period.
- Session count.
- Material count.
- Group names.
- Card color and banner image when available.

Clicking a course card navigates to `/public/courses/[courseId]`.

### `/public/courses/[courseId]`

The public course detail page shows:

- Village name.
- Course name.
- Status.
- Period.
- Session count.
- Material count.
- Group names.
- Session schedule.
- Material title/description list.
- Link back to the public catalog.

If the course is hidden or does not exist, the page returns a not-found style state and does not leak whether a hidden course exists.

### `/workspaces/[workspaceId]/courses/[courseId]/home`

The existing operator course home gets an always-visible public preview section.

The section shows:

- Public visibility status: public or hidden.
- Toggle for public catalog visibility.
- Public preview using the same public DTO used by `/public/courses/[courseId]`.
- Link to the public course detail page when the course is public.

When a course is hidden, the preview still renders and shows a notice that the course is not visible to external visitors.

## Data Model

Add a course-level public visibility field.

```text
courses.public_visibility
- public: default; shown in public catalog and public detail.
- hidden: excluded from public catalog and public detail.
```

Use a PostgreSQL enum named `course_public_visibility` to match the existing enum-heavy migration style.

Default visibility is `public` so operators do not need extra work for ordinary courses to appear in the public catalog.

## Public DTO

Create a public catalog service that never returns internal DTOs directly.

```text
src/services/public-catalog.ts
```

Suggested functions:

```ts
getPublicCourseCatalog(): Promise<ApiResult<PublicCourseCatalog>>;
getPublicCourseDetail(courseId: UUID): Promise<ApiResult<PublicCourseDetail>>;
getCoursePublicPreview(input: {
  workspaceId: UUID;
  courseId: UUID;
}): Promise<ApiResult<PublicCourseDetail>>;
updateCoursePublicVisibility(input: {
  workspaceId: UUID;
  courseId: UUID;
  publicVisibility: 'public' | 'hidden';
}): Promise<ApiResult<{ publicVisibility: 'public' | 'hidden' }>>;
```

The catalog/detail DTO may include only:

- Workspace id and name.
- Course id, name, status, startsOn, endsOn, cardColor, bannerUrl.
- Group names.
- Session number, date, startsAt, endsAt, type, progressStatus.
- Material title and description.
- Session count and material count.

The DTO must not include:

- Participant ids or names.
- Attendance data.
- Attendance notes or class memos.
- Material download URLs.
- `storage_path`, `original_filename`, MIME type, or file size.
- Member ids, user ids, or emails.
- Internal permission booleans.

## Data Rules

Public catalog includes only courses where:

- `courses.public_visibility = 'public'`.
- The parent workspace exists.
- The course is not otherwise deleted, if deletion semantics are added later.

Public detail includes only courses that satisfy the same public visibility rule.

The operator preview may load hidden courses, but only after normal workspace/course access checks. It uses the same public projection shape as public detail.

Materials shown publicly are metadata only:

- Include title.
- Include description when present.
- Exclude files and download behavior.

Sessions shown publicly are schedule summaries only:

- Include visible schedule fields.
- Do not include attendance, attendance rollups, or class memos.

## Sorting

Village sections:

```text
workspace.name asc
```

Courses inside a village:

```text
in_progress
planned
completed
updated_at desc
created_at desc
```

Sessions:

```text
date asc
starts_at asc
session_no asc
```

Materials:

```text
created_at desc
```

## Permissions

Public catalog and public detail require no login.

Updating public visibility requires the same authority as managing full course details:

- Owner admin can update.
- Group admin can update only when they can manage the full course.
- Instructor cannot update.

The server action must re-check permissions. The client toggle is only a UI convenience.

## UI Components

Create reusable display components for the public projection:

- `PublicCourseCard`: used on `/`.
- `PublicCourseDetailView`: used by `/public/courses/[courseId]` and the operator preview.
- `CoursePublicPreviewSection`: used on the operator course home.

The public catalog should use a simple card grid grouped by village. The detail page should be readable and shareable, with clear sections for course information, sessions, and material summaries.

## Error and Empty States

Catalog:

- If no public courses exist, show "아직 공개된 수업이 없습니다."
- If one village has no public courses, do not render that village section.

Detail:

- Hidden, missing, or inaccessible public course returns the same not-found style state.
- Missing material summaries show "공개할 자료 요약이 아직 없습니다."
- Missing sessions show "등록된 회차 일정이 없습니다."

Operator preview:

- If hidden, show "현재 숨김 상태라 외부 공개 페이지에는 표시되지 않습니다."
- If preview loading fails, show a local error inside the preview section without breaking the whole course home.

## Testing

Add focused tests or verification coverage for:

- `/` is accessible without login.
- Public catalog excludes hidden courses.
- Public detail excludes hidden courses and does not leak hidden course existence.
- Operator course home shows public preview even when the course is hidden.
- Visibility toggle is rejected for instructors and unauthorized users.
- Visibility toggle works for users who can manage the full course.
- Public DTO does not include forbidden fields such as participants, attendance, class memos, storage paths, filenames, member emails, or download URLs.

## Documentation Updates

Update project docs after implementation:

- `README.md`: add the public course catalog phase summary.
- `architecture.md`: document public catalog projection and `courses.public_visibility`.
- `docs/api-spec.md`: add public catalog query/action contracts.

If public queries require admin-client reads to avoid RLS mismatch, document the reason in the README RLS/spec conflict section and keep the service projection strict.
