import * as assert from "node:assert/strict";

import { buildWorkspaceMemberList } from "./workspace-members.list";

const members = buildWorkspaceMemberList({
  rows: [
    {
      id: "active-member",
      email: "active@example.com",
      display_name: "Active",
      memo: null,
      role: "instructor",
      status: "active",
      user_id: "user-1",
    },
    {
      id: "removed-member",
      email: "removed@example.com",
      display_name: "Removed",
      memo: null,
      role: "instructor",
      status: "removed",
      user_id: "user-2",
    },
  ],
  groupsByMember: new Map(),
  currentUserId: "user-1",
});

assert.deepEqual(
  members.map((member) => member.id),
  ["active-member"],
);
