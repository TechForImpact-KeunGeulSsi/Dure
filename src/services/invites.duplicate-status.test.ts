import * as assert from "node:assert/strict";

import { isBlockingInviteDuplicateStatus } from "./invites.duplicates";

assert.equal(isBlockingInviteDuplicateStatus("active"), true);
assert.equal(isBlockingInviteDuplicateStatus("invited"), true);
assert.equal(isBlockingInviteDuplicateStatus("disabled"), true);
assert.equal(isBlockingInviteDuplicateStatus("removed"), false);
