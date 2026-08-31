import * as assert from "node:assert/strict";

import { authUsersIncludeEmail } from "./auth-users";

assert.equal(
  authUsersIncludeEmail([{ email: "Owner@example.test" }], " owner@example.test "),
  true,
);

assert.equal(
  authUsersIncludeEmail(
    [{ email: "other@example.test" }, { email: null }],
    "new@example.test",
  ),
  false,
);
