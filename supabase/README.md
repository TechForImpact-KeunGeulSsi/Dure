# DURE Supabase Database

This directory contains the reproducible Supabase database baseline for the DURE MVP.

For developer environment variables, local Supabase usage, and Vercel preview setup, see `docs/environment.md`.

## Current project

- Supabase project name: `DURE`
- Supabase project ref: `oyoexxqaeayaksfoixxr`
- Region: `ap-northeast-2` / Northeast Asia (Seoul)
- Project URL: `https://oyoexxqaeayaksfoixxr.supabase.co`

## What is included

- Core enums from `architecture.md`
- Workspace, member, group, participant, course, session, material, schedule, attendance, memo, invite, and activity tables
- Tenant-scoped foreign keys and indexes
- RLS helper functions:
  - `current_member_id(workspace_id)`
  - `is_workspace_owner(workspace_id)`
  - `accessible_group_ids(workspace_id)`
  - `can_access_group(group_id)`
  - `can_access_course(course_id)`
  - `can_manage_full_course(course_id)`
  - `can_access_session(session_id)`
  - `can_access_material(material_id)`
- `create_workspace(name, timezone)` RPC for creating a workspace and first owner membership
- Invariant triggers for:
  - last active owner protection
  - course participant group membership within course groups
  - material group membership within course groups
  - material review reset after file/title/description replacement
- Private `course-materials` Storage bucket and Storage object policies

## Local setup

1. Start Docker Desktop.
2. Reset the local database:

```bash
supabase db reset
```

3. Copy `.env.example` to `.env.local` in the application project and fill it from:

```bash
supabase status
```

The local Studio URL is configured by `supabase/config.toml`.

## Remote setup

The repository intentionally does not store Supabase access tokens or project credentials.

Required values:

- Supabase access token for the CLI
- Supabase project ref for the target project
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `APP_URL`
- `CRON_SECRET`

After logging in and linking the project:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Then configure the same environment variables in Vercel:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SUPABASE_JWT_SECRET
vercel env add APP_URL
vercel env add CRON_SECRET
```

## Application notes

- Use `public.create_workspace(name, timezone)` after the first authenticated login. Direct workspace inserts are allowed for owner-created rows, but the RPC also creates the first `owner_admin` membership.
- Pending invite users are represented by `workspace_members.user_id = null`, `status = invited`, and an email.
- Participants are operational data only. They never map to `auth.users`.
- Course material files should use:

```text
workspaces/{workspace_id}/courses/{course_id}/materials/{material_id}/{file_id}-{safe_filename}
```

- The `course-materials` bucket is private. The app should issue signed upload/download URLs only after checking DB permissions.
