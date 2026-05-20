import * as assert from "node:assert/strict";

import { authUsersIncludeEmail } from "./auth-users";

assert.equal(
  authUsersIncludeEmail([{ email: "Owner@Dure.edu" }], " owner@dure.edu "),
  true,
);

assert.equal(
  authUsersIncludeEmail([{ email: "other@dure.edu" }, { email: null }], "new@dure.edu"),
  false,
);
