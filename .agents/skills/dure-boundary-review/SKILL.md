---
name: dure-boundary-review
description: Review a DURE change that affects authorization, tenant scope, RLS/RPC, admin-client use, Storage, or sensitive participant/member data.
---

# DURE Boundary Review

Use only when the changed surface crosses an authorization, tenant, RLS/RPC, admin-client, Storage, or sensitive-data boundary.

- Trace authenticated user → active membership belonging to that user → role → group/course scope → target workspace/state. Preserve bootstrap exceptions and do not trust caller-supplied IDs.
- Check service authorization and database policy separately. For scope changes, include a denied role/scope case and another workspace where relevant; for materials, check private-bucket paths, signed downloads, upload/replacement cleanup, and reassignment or scope removal.
- Compare returned DTOs with the receiving role; participant names/memos, member emails/IDs, file contents, and raw Storage paths must not leak beyond the authorized surface. Treat retired app entry points and retained database objects separately.
- Report concrete findings with path/line, affected allow/deny case, and evidence gap. Do not edit files or require a separate planning artifact.
