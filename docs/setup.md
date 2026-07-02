# Local Setup

## Prerequisites

- Node.js compatible with Next.js 15
- npm
- Docker Desktop
- Supabase CLI

## Install

```bash
npm install
cp .env.example .env.local
```

Start Supabase and reset the local database:

```bash
supabase start
supabase db reset
```

Run the app:

```bash
npm run dev
```

Useful local URLs:

- App: http://localhost:3000
- Supabase Studio: http://127.0.0.1:54323
- Inbucket: http://127.0.0.1:54324

## Environment Variables

After `supabase start`, copy values from `supabase status` into `.env.local`.

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase status service_role key>
SUPABASE_JWT_SECRET=<supabase status JWT secret>
APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` must be the service_role key, not the anon key. If these are mixed up, admin operations such as material upload, invite link generation, user listing, and signed URL generation can fail with `"No suitable key or wrong key type"`.

After changing environment variables, restart Next.js. If the old value appears cached, clear `.next` first:

```bash
rm -rf .next
npm run dev
```

## Database Updates

When new files are added under `supabase/migrations/`, apply them locally before running the app.

Keep local data:

```bash
npx supabase migration up
```

Reset local data:

```bash
supabase db reset
```
