import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

import { validatePullRequestBody } from "./check-pr.mjs";

const repository = "acme/example";

function validBody({ relatedIssue = "#123", unchecked = true } = {}) {
  return `## Summary\nImplemented the requested workflow.\n\n## Related Issue\n${relatedIssue}\n\n## Changes\n- Added validation.\n\n## Testing\n- node --test scripts/check-pr.test.mjs\n\n## Documentation\nUpdated the workflow documentation.\n\n## Architecture Decision\nNo ADR required.\n\n## Risks / Trade-offs\nThe checker validates structure only.\n\n## Review Checklist\n- [${unchecked ? " " : "x"}] Focused review complete\n`;
}

function runCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/check-pr.mjs", ...args], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("accepts all required sections with an unchecked checklist", () => {
  assert.deepEqual(validatePullRequestBody(validBody(), { repository }), { errors: [] });
});

test("reports missing, duplicate, and empty sections", () => {
  const body = `## Summary\n\n## Summary\ncontent\n\n## Related Issue\n#123\n\n## Changes\ncontent\n\n## Testing\ncontent\n\n## Documentation\ncontent\n\n## Architecture Decision\ncontent\n\n## Risks / Trade-offs\ncontent\n`;
  const { errors } = validatePullRequestBody(body);
  assert.ok(errors.some((error) => error.includes("exactly once: Summary")));
  assert.ok(errors.some((error) => error.includes("substantive content: Summary")));
  assert.ok(errors.some((error) => error.includes("Missing required section: Review Checklist")));
});

test("ignores headings inside comments and fenced code", () => {
  const body = `<!--\n## Summary\n## Related Issue\n#999\n-->\n\n## Summary\nReal summary.\n\n## Related Issue\n#123\n\n## Changes\n\`\`\`html\n<!-- this comment never closes inside the example\n## Testing\n\`\`\`\n\n## Testing\nA real test.\n\n## Documentation\nDocs.\n\n## Architecture Decision\nNone.\n\n## Risks / Trade-offs\nLow.\n\n## Review Checklist\n- [ ] Review\n`;
  assert.deepEqual(validatePullRequestBody(body), { errors: [] });
});

test("rejects issue false positives and accepts a same-repository issue URL", () => {
  const external = validBody({ relatedIssue: "https://github.com/other/project/issues/123" });
  assert.ok(validatePullRequestBody(external, { repository }).errors.some((error) => error.includes("Related Issue")));

  const externalLinkedLabel = validBody({ relatedIssue: "[#123](https://github.com/other/project/issues/123)" });
  assert.ok(validatePullRequestBody(externalLinkedLabel, { repository }).errors.some((error) => error.includes("Related Issue")));

  const pullRequestUrl = validBody({ relatedIssue: "https://github.com/acme/example/pull/123" });
  assert.ok(validatePullRequestBody(pullRequestUrl, { repository }).errors.some((error) => error.includes("Related Issue")));

  const externalFragment = validBody({ relatedIssue: "https://example.com/#123" });
  assert.ok(validatePullRequestBody(externalFragment).errors.some((error) => error.includes("Related Issue")));

  const sameRepository = validBody({ relatedIssue: "https://github.com/acme/example/issues/123" });
  assert.deepEqual(validatePullRequestBody(sameRepository, { repository }), { errors: [] });

  const codeOnly = validBody({ relatedIssue: "\`\`\`\n#123\n\`\`\`" });
  assert.ok(validatePullRequestBody(codeOnly).errors.some((error) => error.includes("Related Issue")));
});

test("CLI validates a file and reports failures without printing its body", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dure-check-pr-"));
  try {
    const validPath = join(directory, "valid.md");
    const invalidPath = join(directory, "invalid.md");
    await writeFile(validPath, validBody(), "utf8");
    await writeFile(invalidPath, "## Summary\nsecret body\n", "utf8");

    const success = await runCli([validPath]);
    assert.equal(success.code, 0);
    assert.match(success.stdout, /validation passed/);
    assert.equal(success.stderr, "");

    const failure = await runCli([invalidPath]);
    assert.equal(failure.code, 1);
    assert.match(failure.stderr, /validation failed/);
    assert.doesNotMatch(failure.stderr, /secret body/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI reads pull_request.body from GITHUB_EVENT_PATH when no file is given", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dure-check-pr-event-"));
  try {
    const eventPath = join(directory, "event.json");
    await writeFile(eventPath, JSON.stringify({
      pull_request: { body: validBody({ relatedIssue: "https://github.com/acme/example/issues/7" }) },
      repository: { full_name: repository },
    }), "utf8");

    const result = await runCli([], { GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: "" });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /validation passed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI clearly fails for a missing file and a non-PR event", async () => {
  const missingFile = await runCli(["/tmp/dure-check-pr-file-does-not-exist.md"]);
  assert.equal(missingFile.code, 1);
  assert.match(missingFile.stderr, /Unable to read the pull request body file/);

  const directory = await mkdtemp(join(tmpdir(), "dure-check-pr-non-pr-"));
  try {
    const eventPath = join(directory, "event.json");
    await writeFile(eventPath, JSON.stringify({ issue: {} }), "utf8");
    const nonPrEvent = await runCli([], { GITHUB_EVENT_PATH: eventPath });
    assert.equal(nonPrEvent.code, 1);
    assert.match(nonPrEvent.stderr, /does not describe a pull_request event/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
