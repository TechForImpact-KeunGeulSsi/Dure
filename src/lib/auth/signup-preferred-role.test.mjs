import * as assert from "node:assert/strict";

import {
  coerceSignupPreferredRole,
  defaultJoinRequestRoleFromPreference,
} from "./signup-preferred-role.ts";

assert.equal(coerceSignupPreferredRole("owner_admin"), "owner_admin");
assert.equal(coerceSignupPreferredRole("group_admin"), "group_admin");
assert.equal(coerceSignupPreferredRole("instructor"), "instructor");
assert.equal(coerceSignupPreferredRole("운영자"), null);
assert.equal(coerceSignupPreferredRole(undefined), null);

assert.equal(defaultJoinRequestRoleFromPreference("instructor"), "instructor");
assert.equal(defaultJoinRequestRoleFromPreference("group_admin"), "group_admin");
assert.equal(defaultJoinRequestRoleFromPreference("owner_admin"), "owner_admin");
assert.equal(defaultJoinRequestRoleFromPreference(null), "instructor");
