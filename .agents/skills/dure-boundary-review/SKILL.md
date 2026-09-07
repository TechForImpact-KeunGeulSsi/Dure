---
name: dure-boundary-review
description: Review changed DURE authorization, tenant, RLS/RPC, admin-client, file, participant-data, or external-service boundaries.
---

# DURE Boundary Review

Review the actual plan or diff at the service/database boundary. Apply AGENTS.md's invariants to the affected actors and operations; do not impose existing-membership checks on bootstrap flows.

Trace authorization through current-user membership lookup, role, group intersection versus full-course scope, and target workspace/state. Membership and target lookups may use admin access to establish authorization; data exposure or mutation must follow authorization. Check direct RLS/RPC access separately, including composite foreign keys and a second workspace.

For invite acceptance or workspace creation/join, inspect the specific token/email/session/target-state contract before membership exists. For materials, inspect input validation against bucket and Server Action body limits, tenant paths, authorized signing, and failed upload/replacement cleanup. Include access after instructor reassignment or group-scope removal; current uploader exceptions are recorded in `docs/STATUS.md` and are not proof of the intended policy.

Compare returned DTO fields with the receiving role: participant names/memos, member emails/IDs, file contents, and raw Storage paths must not leak into broader surfaces. Use synthetic verification data. Retired feedback, settlement, and ReviewMaterial DB objects can retain capabilities even though app entry points are gone; distinguish app retirement from DB revocation.

For a new external integration, identify permission-filtered input, cost/side effects, and authorization needed for the proposed operation.

Report concrete findings with path/line, affected allow/deny cases, and residual risk. For release review, distinguish required changes from unavailable evidence. An actor/action matrix helps when several roles differ.
