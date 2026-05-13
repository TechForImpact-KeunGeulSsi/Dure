# DURE Environment Setup

이 문서는 개발자가 DURE 저장소를 받아 작업을 시작할 때 필요한 환경 정보를 정리한다. 비밀값은 저장소에 커밋하지 않는다.

## 1. Supabase 프로젝트

현재 원격 Supabase 프로젝트:

- Project name: `DURE`
- Project ref: `oyoexxqaeayaksfoixxr`
- Region: `ap-northeast-2` / Northeast Asia (Seoul)
- Project URL: `https://oyoexxqaeayaksfoixxr.supabase.co`

Supabase CLI로 원격 프로젝트를 연결할 때:

```bash
supabase login
supabase link --project-ref oyoexxqaeayaksfoixxr
```

원격 DB에 migration을 반영할 때:

```bash
supabase db push
```

## 2. 로컬 Supabase 사용 여부

DB, RLS, Storage, Auth, migration을 수정하거나 검증하는 개발자는 로컬 Supabase를 사용한다.

필요 조건:

- Docker Desktop 실행
- Supabase CLI 설치

로컬 DB 초기화:

```bash
supabase db reset
```

로컬 상태 확인:

```bash
supabase status
```

현재 로컬 포트 기준:

| 항목 | 값 |
| --- | --- |
| API URL | `http://127.0.0.1:54321` |
| DB port | `54322` |
| Studio URL | `http://127.0.0.1:54323` |
| Inbucket URL | `http://127.0.0.1:54324` |
| App URL | `http://localhost:3000` |

프론트엔드 UI만 작업하고 DB 정책을 건드리지 않는 개발자는 공유된 원격 preview/staging Supabase 값을 사용할 수 있다. 단, RLS나 migration 관련 작업은 반드시 로컬에서 검증한다.

## 3. 환경변수

`.env.example`을 복사해 `.env.local`을 만든다.

```bash
cp .env.example .env.local
```

필요한 변수:

| 변수 | 로컬 개발 값 | 원격/Preview 값 | 비고 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase status`의 API URL | Supabase Project API URL | 클라이언트 노출 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase status`의 anon key | Supabase anon public key | 클라이언트 노출 가능 |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase status`의 service_role key | Supabase service role key | 서버 전용, 공유 주의 |
| `SUPABASE_JWT_SECRET` | `supabase status`의 JWT secret | Supabase JWT secret | 서버 전용 |
| `APP_URL` | `http://localhost:3000` | Vercel preview 또는 production URL | 초대 링크 기준 URL |
| `CRON_SECRET` | 팀에서 정한 임의 문자열 | Vercel env와 동일한 값 | cron endpoint 보호 |

비밀값 제공 방식:

- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `CRON_SECRET`은 Slack/문서에 평문으로 남기지 않는다.
- 1Password, Vercel Environment Variables, Supabase Dashboard 권한 부여 중 하나로 제공한다.
- 개발자가 로컬 Supabase만 쓰는 경우 `supabase status`로 로컬 비밀값을 직접 확인한다.

## 4. Vercel Preview 사용 여부

Vercel preview를 사용한다.

현재 로컬 디렉터리는 Vercel 프로젝트 `dure`에 연결된 흔적이 있다. `.vercel/`은 개인 로컬 메타데이터이므로 공유하거나 커밋하지 않는다.

Vercel 프로젝트 정보:

- Project name: `dure`
- Project ID: `prj_X5YLT55bLqUhoZBxayCqa0LFOkQa`
- Org/Team ID: `team_ouKHw4G2eRhml3neYDrTH7Wd`

개발자에게 필요한 것:

- Vercel 팀 접근 권한
- Preview/Production 환경변수 설정 권한 또는 관리자에게 요청할 권한

Vercel에 설정해야 하는 환경변수:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SUPABASE_JWT_SECRET
vercel env add APP_URL
vercel env add CRON_SECRET
```

Preview 환경의 `APP_URL`은 배포 URL이 바뀔 수 있으므로, 초대 링크 테스트가 필요한 경우 고정 preview 도메인이나 production URL 기준으로 별도 확인한다.

## 5. 개발자에게 아직 제공해야 하는 값

아래 값은 저장소에서 확인할 수 없거나 비밀값이므로 프로젝트 관리자가 제공해야 한다.

- Supabase Dashboard 접근 권한 또는 원격 anon key
- 원격 `SUPABASE_SERVICE_ROLE_KEY`
- 원격 `SUPABASE_JWT_SECRET`
- 팀 공통 `CRON_SECRET`
- Vercel 팀 초대
- Figma 또는 UI 디자인 원본 링크

## 6. 작업 시작 체크리스트

- `AGENTS.md`를 읽었다.
- 작업 성격에 맞는 문서만 먼저 읽었다.
- `.env.local`을 만들었다.
- 로컬 Supabase가 필요한 작업이면 Docker Desktop을 켜고 `supabase db reset`을 실행했다.
- 원격 Supabase를 쓰는 작업이면 필요한 환경변수를 안전한 경로로 받았다.
- Vercel preview가 필요한 작업이면 Vercel 팀 접근 권한과 env 설정 여부를 확인했다.
