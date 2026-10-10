import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const REQUIRED_SECTIONS = [
  "Summary",
  "Related Issue",
  "Changes",
  "Testing",
  "Documentation",
  "Architecture Decision",
  "Risks / Trade-offs",
  "Review Checklist",
];

function removeHtmlComments(text, state = { inComment: false }) {
  let result = "";
  let cursor = 0;

  while (cursor < text.length) {
    if (state.inComment) {
      const end = text.indexOf("-->", cursor);
      if (end === -1) return result;
      state.inComment = false;
      cursor = end + 3;
      continue;
    }

    const start = text.indexOf("<!--", cursor);
    if (start === -1) {
      result += text.slice(cursor);
      break;
    }

    result += text.slice(cursor, start);
    const end = text.indexOf("-->", start + 4);
    if (end === -1) {
      state.inComment = true;
      break;
    }

    cursor = end + 3;
  }

  return result;
}

function parseHeadings(body) {
  const lines = body.split(/\r?\n/);
  const headings = [];
  const commentState = { inComment: false };
  let fence = null;

  lines.forEach((line, index) => {
    if (fence) {
      const close = new RegExp(`^\\s{0,3}${fence.character}{${fence.length},}\\s*$`);
      if (close.test(line)) fence = null;
      return;
    }

    const visibleLine = removeHtmlComments(line, commentState);
    const trimmed = visibleLine.trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(?:.*)$/);
    if (fenceMatch) {
      fence = { character: fenceMatch[1][0], length: fenceMatch[1].length };
      return;
    }

    const headingMatch = visibleLine.match(/^\s{0,3}##(?!#)\s+(.+?)\s*$/);
    if (!headingMatch) return;

    let title = headingMatch[1].trim();
    if (title.endsWith("#")) title = title.replace(/\s+#+\s*$/, "").trim();
    headings.push({ index, title });
  });

  return { lines, headings };
}

function removeCommentsOutsideFences(text) {
  const lines = text.split(/\r?\n/);
  const commentState = { inComment: false };
  const output = [];
  let fence = null;

  for (const line of lines) {
    if (fence) {
      output.push(line);
      const close = new RegExp(`^\\s{0,3}${fence.character}{${fence.length},}\\s*$`);
      if (close.test(line)) fence = null;
      continue;
    }

    const visibleLine = removeHtmlComments(line, commentState);
    output.push(visibleLine);
    const fenceMatch = visibleLine.trimStart().match(/^(`{3,}|~{3,})(?:.*)$/);
    if (fenceMatch) fence = { character: fenceMatch[1][0], length: fenceMatch[1].length };
  }

  return output.join("\n");
}

function sectionText(lines, headings, headingIndex) {
  const start = headings[headingIndex].index + 1;
  const end = headings[headingIndex + 1]?.index ?? lines.length;
  const text = lines.slice(start, end).join("\n");
  const withoutComments = removeCommentsOutsideFences(text);

  return withoutComments.trim();
}

function hasSubstantiveContent(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s{0,3}(`{3,}|~{3,})(?:.*)$/.test(line))
    .some((line) => line.trim().length > 0);
}

function contentForIssueCheck(text) {
  const lines = text.split(/\r?\n/);
  const visible = [];
  let fence = null;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (fence) {
      const close = new RegExp(`^\\s{0,3}${fence.character}{${fence.length},}\\s*$`);
      if (close.test(line)) fence = null;
      continue;
    }

    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(?:.*)$/);
    if (fenceMatch) {
      fence = { character: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }

    visible.push(line);
  }

  return visible.join("\n");
}

function hasRelatedIssue(text, repository) {
  const visible = contentForIssueCheck(text);
  const repositoryName = typeof repository === "string" ? repository : repository?.full_name;
  if (repositoryName && /^[^/\s]+\/[^/\s]+$/.test(repositoryName)) {
    const escapedRepository = repositoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(
      `https://github\\.com/${escapedRepository}/issues/[1-9]\\d*(?:\\b|[?#])`,
      "i",
    ).test(visible)) return true;
  }

  // A linked label such as [#123](https://other.example/issues/123) is not a
  // local short reference. Same-repository URLs were accepted above.
  const withoutMarkdownLinks = visible.replace(/\[[^\]]*\]\(\s*[^)\s]+(?:\s+["'][^)]*)?\s*\)/g, " ");
  const withoutUrls = withoutMarkdownLinks.replace(/https?:\/\/[^\s)]+/gi, " ");
  return /(^|[^\w#/])#[1-9]\d*(?![\w])/.test(withoutUrls);
}

/**
 * Validate the required structure of a pull request body.
 *
 * This intentionally checks structure and references only. It does not
 * verify that an issue exists, that tests really ran, or that checkboxes are
 * complete.
 */
export function validatePullRequestBody(body, { repository } = {}) {
  const errors = [];
  if (typeof body !== "string") {
    return { errors: ["Pull request body is missing."] };
  }

  const { lines, headings } = parseHeadings(body);
  const sections = new Map();

  headings.forEach((heading, index) => {
    if (!REQUIRED_SECTIONS.includes(heading.title)) return;
    const entries = sections.get(heading.title) ?? [];
    entries.push({ text: sectionText(lines, headings, index) });
    sections.set(heading.title, entries);
  });

  for (const section of REQUIRED_SECTIONS) {
    const entries = sections.get(section) ?? [];
    if (entries.length === 0) {
      errors.push(`Missing required section: ${section}.`);
      continue;
    }
    if (entries.length > 1) errors.push(`Section must appear exactly once: ${section}.`);
    if (!hasSubstantiveContent(entries[0].text)) {
      errors.push(`Section must contain substantive content: ${section}.`);
    }
  }

  const relatedIssue = sections.get("Related Issue")?.[0];
  if (relatedIssue?.text && !hasRelatedIssue(relatedIssue.text, repository)) {
    errors.push(
      repository
        ? "Related Issue must include a non-zero #123 reference or a same-repository GitHub issue URL."
        : "Related Issue must include a non-zero #123 reference.",
    );
  }

  return { errors };
}

async function loadBodyFromEvent(eventPath, env) {
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required when no body file is provided.");

  let event;
  try {
    event = JSON.parse(await readFile(eventPath, "utf8"));
  } catch {
    throw new Error("Unable to read GITHUB_EVENT_PATH as JSON.");
  }

  if (!event?.pull_request || typeof event.pull_request !== "object") {
    throw new Error("GITHUB_EVENT_PATH does not describe a pull_request event.");
  }
  if (typeof event.pull_request.body !== "string") {
    throw new Error("The pull request body is missing.");
  }

  return {
    body: event.pull_request.body,
    repository: env.GITHUB_REPOSITORY || event.repository?.full_name,
  };
}

export async function runCli(argv = process.argv.slice(2), env = process.env) {
  try {
    let body;
    let repository;
    if (argv[0]) {
      try {
        body = await readFile(resolve(argv[0]), "utf8");
      } catch {
        throw new Error("Unable to read the pull request body file.");
      }
      repository = env.GITHUB_REPOSITORY;
    } else {
      const loaded = await loadBodyFromEvent(env.GITHUB_EVENT_PATH, env);
      body = loaded.body;
      repository = loaded.repository;
    }

    const { errors } = validatePullRequestBody(body, { repository });
    if (errors.length > 0) {
      process.stderr.write(`Pull request body validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}\n`);
      return 1;
    }

    process.stdout.write("Pull request body validation passed.\n");
    return 0;
  } catch (error) {
    process.stderr.write(`Pull request body validation failed: ${error.message}\n`);
    return 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  process.exitCode = await runCli();
}
