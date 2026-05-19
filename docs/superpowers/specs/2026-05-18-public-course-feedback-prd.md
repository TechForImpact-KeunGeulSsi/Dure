# Public Course Feedback PRD

## Context

DURE already lets unauthenticated visitors browse public village courses and open a public course detail page. The next goal is to let parents or other external visitors leave lightweight feedback about a specific public course without logging in, and let workspace operators review that feedback from the existing workspace dashboard.

This feature should be implemented with the smallest practical change set. It should extend the public course detail page and the existing empty workspace feedback page, without introducing replies, realtime updates, moderation workflows, or broad public profile changes.

## Goals

- Let unauthenticated visitors submit feedback for a specific public course.
- Keep feedback tied to a course, not to a whole workspace or village.
- Let operators review feedback by course from `/workspaces/[workspaceId]/feedback`.
- Let operators mark feedback as reviewed so new feedback is easy to distinguish.
- Let owner admins physically delete feedback when needed.
- Record feedback creation in recent activity.
- Preserve enough course context to keep feedback understandable if the course name later changes.

## Non-Goals

- No workspace-level or village-level feedback.
- No public display of submitted feedback.
- No public reply, answer, or status tracking for the submitter.
- No realtime updates in the operator page.
- No pagination in the first implementation.
- No CAPTCHA, rate limiting, IP hashing, or spam workflow in the first implementation.
- No feedback form inside the internal operator public preview.
- No separate feedback detail page or modal.
- No instructor access to the feedback page.

## Users

### External Visitor

An unauthenticated parent, resident, or other visitor viewing a public course detail page.

Needs:

- Understand which course they are commenting on.
- Leave a short opinion without creating an account.
- Optionally leave a name and phone number if they want follow-up contact.
- Know that their feedback was submitted.

### Owner Admin

A workspace-wide operator.

Needs:

- See all course feedback in the workspace.
- Filter by course, category, and status.
- Mark feedback as reviewed or new.
- Delete feedback when necessary.

### Group Admin

An operator scoped to specific groups.

Needs:

- See feedback for courses connected to their accessible groups.
- Filter and review feedback in their accessible scope.
- Mark accessible feedback as reviewed or new.

### Instructor

An instructor assigned to courses.

Needs:

- No access in this phase.

## Routes

### `/public/courses/[courseId]`

The public course detail page shows a feedback form near the bottom of the page.

The form is shown only on the real public course detail route. It is not shown in the internal operator preview component.

The form includes:

- Category selector.
- Feedback message textarea.
- Optional name field.
- Optional phone number field.
- Required privacy consent checkbox.
- Submit button.

After a successful submission:

- Show a simple success message: `의견이 전달되었습니다.`
- Reset the form.
- Do not show the submitted feedback publicly.

If the course is hidden, missing, or otherwise not publicly accessible, the public detail page keeps its existing not-found behavior and no feedback form is available.

### `/workspaces/[workspaceId]/feedback`

The existing workspace feedback page becomes the operator feedback inbox.

The page shows:

- Summary counts for new and reviewed feedback.
- Filters for course, category, and status.
- A latest-first list of recent feedback.
- A note that the list is based on the latest 100 feedback items.

Course filter options include only courses that currently have feedback in the accessible result set.

Each feedback item shows:

- Course name snapshot.
- Category label.
- Status label.
- Submitted date/time.
- Author display:
  - `익명` when no name was provided.
  - Name when only name was provided.
  - Name and phone number when both were provided.
- Full message text.
- Review action:
  - `확인 처리` for new feedback.
  - `미확인으로 되돌리기` for reviewed feedback.
- Delete action only for owner admins.

No separate detail page is required.

## Data Requirements

Create a course feedback record for each submitted item.

Required stored fields:

- `workspace_id`
- `course_id`
- `course_name_snapshot`
- `category`
- `message`
- `status`
- `privacy_consent_at`
- `created_at`
- `updated_at`

Optional stored fields:

- `author_name`
- `author_phone`

Recommended status values:

```text
new
reviewed
```

Recommended category values:

```text
suggestion
praise
other
```

Category labels:

```text
suggestion -> 제안
praise -> 좋았던 점
other -> 기타
```

`course_name_snapshot` is stored at submission time so feedback remains understandable if the course name changes later.

## Validation Rules

Public submission requires:

- `courseId` points to a currently public course.
- `category` is one of `suggestion`, `praise`, `other`.
- `message` is present and within the accepted length limit.
- `privacyConsent` is true.

Optional author fields:

- `authorName` is optional.
- `authorPhone` is optional.
- If `authorPhone` is provided, `authorName` is required.
- Phone numbers may include hyphens.

The first implementation does not include spam or abuse controls beyond normal input validation.

## Permissions

### Public Submission

No login is required.

Submission is allowed only when:

- The course exists.
- `courses.public_visibility = 'public'`.
- The course belongs to an existing workspace.

Hidden courses must not reveal their existence through feedback submission errors.

### Operator Read

Owner admin:

- Can read all feedback in the workspace.

Group admin:

- Can read feedback for courses connected to at least one of their accessible groups.

Instructor:

- Cannot read feedback in this phase.

### Review Status Update

Owner admin:

- Can update status for all feedback in the workspace.

Group admin:

- Can update status for feedback in their accessible course scope.

Instructor:

- Cannot update feedback status.

### Delete

Only owner admins can delete feedback.

Deletion is physical deletion in this phase.

## Activity Log

When public feedback is created, write a recent activity event.

The activity metadata should include only non-sensitive summary fields, such as:

- `courseId`
- `courseName`
- `category`
- A short message preview

The activity log must not include the author phone number or the full message.

Deleting feedback does not need to create an activity log event in the first implementation.

## Sorting and Limits

Operator feedback list:

- Sort by `created_at desc`.
- Return the latest 100 accessible feedback items.
- No pagination in the first implementation.

## UI Copy

Public form title:

```text
이 수업에 의견 남기기
```

Category labels:

```text
제안
좋았던 점
기타
```

Privacy consent text:

```text
남긴 의견과 선택 입력한 성함, 전화번호를 수업 운영자가 확인하는 데 동의합니다.
```

Success message:

```text
의견이 전달되었습니다.
```

Operator page title:

```text
의견 수렴
```

Empty state:

```text
아직 접수된 의견이 없습니다.
```

## Acceptance Criteria

- A visitor can submit feedback from a public course detail page without logging in.
- A hidden course cannot receive public feedback.
- Submitted feedback appears on `/workspaces/[workspaceId]/feedback` for owner admins.
- Group admins see only feedback for courses in their accessible group scope.
- Instructors cannot access the feedback inbox.
- Operators can filter feedback by course, category, and status.
- Operators can mark feedback as reviewed and revert it to new.
- Only owner admins can physically delete feedback.
- Feedback creation appears in recent activity without exposing phone numbers or full messages.
- The internal operator public preview does not render the public feedback form.
- The implementation does not add replies, realtime updates, pagination, CAPTCHA, or a feedback detail page.
