---
name: dure-repository-research
description: Trace and scope DURE changes spanning services, permissions, migrations, or operational contracts; includes implementation planning when needed.
---

# DURE Research and Scoping

Trace the owning route, service, migration, or tooling entry point and its callers/tests. Use current code as evidence and AGENTS.md's linked contracts for intended behavior. For instruction audits, the owning surface is configuration/documentation; no product route is required.

For cross-layer changes, identify the relevant DURE chain: page/DTO → service → input validator → session or admin client → table/RPC/RLS/Storage. Check how the current actor obtains workspace and group/course scope. Read historical ontology or migrations only to explain retained behavior, not to infer active product scope.

Scope the change around observable behavior and the affected roles. Include a denied role/scope case for access changes and distinguish source tests from local integration evidence. State data compatibility, retention, and rollback implications when the data model changes. Use dure-boundary-review when the access or sensitive-data contract changes.

Return the relevant files, behavior, intended change, focused verification, and unresolved decisions. A short inline plan is sufficient when scope is clear; a separate plan document or user approval is not a prerequisite. Continue authorized implementation after research. A delegated research-only assignment returns its findings without edits.
