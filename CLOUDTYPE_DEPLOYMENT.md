# IntentBridge · Cloudtype Staging Docker 배포

기존 기능/UI/Auth.js/Resend/권한/Tenant Isolation을 유지합니다. Cloudtype에는 Dockerfile 방식으로 배포하며 PostgreSQL을 사용합니다. GA4/Meta/ChatGPT Ads는 Mock으로 유지합니다. 실제 Secret 값은 이 문서나 이미지에 포함하지 않습니다.

## Cloudtype 설정

| 설정 | 값 |
| --- | --- |
| 실행 방식 / 언어·프레임워크 | Dockerfile |
| 소스 위치 / Build context | package.json과 Dockerfile이 있는 프로젝트 루트 |
| Dockerfile | Dockerfile |
| Port | 3000 (PORT와 동일하게 지정) |
| Health Check | /api/health |
| Start commands | 비워 두고 Dockerfile CMD 사용 |
| Build arguments | Secret을 입력하지 않음 |
| Environment variables | 아래 런타임 변수 등록 |

모노레포/상위 폴더로 저장소를 업로드한다면 이 프로젝트가 있는 하위 디렉터리를 배포 루트로 선택합니다. 정적 Web Application/nginx나 Node.js 자동 빌드 프리셋 대신 Dockerfile을 사용합니다. [Cloudtype Dockerfile 설정](https://docs.cloudtype.dev/ko/developers/dockerfile), [포트 설정](https://docs.cloudtype.dev/ko/developers/port).

## Dockerfile 구조와 명령

Node 22 Debian slim + OpenSSL/CA → lockfile 기반 npm ci → PostgreSQL Prisma Client 생성 → Next.js production build → 비 root(node, UID/GID 1000) 실행 이미지입니다. 빌드와 실행 모두 APP_ENV=staging, NODE_ENV=production, GA4_DATA_MODE=mock을 사용합니다. 빌드 시 설정되는 APP_ENV는 HSTS 응답 구성에도 필요합니다.

기존 TypeScript next.config.ts와 수동 migration/admin 명령을 실행할 수 있도록 node_modules에는 devDependencies도 의도적으로 보존했습니다. 전체 앱 소스·테스트·Reference HTML은 실행 이미지에 복사하지 않습니다. 현재 public 폴더가 없어도 빌드가 되며 추후 추가된 public 파일도 복사합니다.

**Build Command (Cloudtype가 Dockerfile을 실행하므로 별도 Node Build Command 불필요):**

```sh
docker build -t intentbridge-staging .
```

Dockerfile 내부에서는 `npm ci --include=dev` → `npm run db:generate:pg` → `npm run build`를 실행합니다. DB 접속이나 migration, seed는 빌드에 포함하지 않습니다.

**Start Command (CMD 기본값):**

```sh
node node_modules/next/dist/bin/next start --hostname 0.0.0.0
```

기존 `npm start -- --hostname 0.0.0.0`도 같은 Next.js 서버를 실행합니다. PORT는 Next.js가 환경변수에서 읽습니다. `EXPOSE 3000`은 기본 포트 안내이며 PORT 변경 시 Cloudtype Port 설정도 함께 변경해야 합니다. 시작 때 Prisma generate/migrate/seed를 다시 실행하지 않습니다.

## 런타임 환경변수

빈 항목은 사용자가 Cloudtype의 환경변수/시크릿 설정에 실제 값을 넣습니다. `.env` 파일을 Git이나 이미지에 넣지 않고 Docker build ARG에도 Secret을 넣지 않습니다.

```dotenv
NODE_ENV=production
APP_ENV=staging
PORT=3000
DATABASE_URL=
AUTH_SECRET=
AUTH_URL=
RESEND_API_KEY=
AUTH_EMAIL_FROM=
GA4_DATA_MODE=mock
RATE_LIMIT_STORE=database
LOG_LEVEL=info
TRUST_PROXY_IP=false
NEXT_TELEMETRY_DISABLED=1
```

| 변수 | 설정 방법 |
| --- | --- |
| DATABASE_URL | Staging PostgreSQL 연결 문자열. 런타임 Secret으로 보관 |
| AUTH_SECRET | 최소 32자 이상 충분히 긴 랜덤 Secret. 배포/인스턴스 간 동일 값 유지 |
| AUTH_URL | 사용자가 접속할 Cloudtype 또는 사용자 지정 HTTPS 주소. 경로 없이 해당 서비스 origin 지정 |
| RESEND_API_KEY | 발신 도메인에 사용할 Resend 키. 기존 AUTH_RESEND_KEY 별칭과 중복 설정하지 않음 |
| AUTH_EMAIL_FROM | Resend에서 검증한 도메인의 발신 주소 |
| RATE_LIMIT_STORE | database 권장. 단일 인스턴스 Staging은 memory 가능하지만 재시작 시 초기화됨 |
| TRUST_PROXY_IP | 기본 false 유지. ingress가 IP 헤더를 덮어쓰고 원본 직접 접속을 막는 구성을 확인한 경우만 true |

GA4_PROPERTY_ID/GA4_PROPERTY_MAP/GOOGLE_APPLICATION_CREDENTIALS 및 광고 매체 API Key는 설정하지 않습니다. Meta 활성화용 새 변수도 없습니다. 선택적 요청 제한/보존 변수는 기존 `.env.example`을 따릅니다.

첫 관리자 준비에만 `INITIAL_ADMIN_EMAIL`을 별도로 지정합니다. 기존 Auth.js trustHost/보안 Cookie/Redirect 설정은 변경하지 않았습니다. HTTPS 및 AUTH_URL 일치는 필수입니다.

## PostgreSQL 연결과 migration

1. 같은 Cloudtype 배포환경에 Staging 전용 PostgreSQL을 생성합니다. DB 이름·계정·비밀번호·내부 호스트·포트를 확인합니다.
2. 앱의 DATABASE_URL에 `postgresql://<USER>:<URL_ENCODED_PASSWORD>@<INTERNAL_HOST>:<PORT>/<DATABASE>?schema=public` 형식으로 구성한 값을 시크릿으로 등록합니다. 위 꺾쇠 값은 형식 안내이며 실제 값이 아닙니다. 컨테이너의 localhost는 PostgreSQL 주소가 아닙니다.
3. 같은 배포환경에서는 제공된 내부 연결 주소를 사용합니다. 외부 PostgreSQL을 쓰면 공급자가 요구하는 TLS/sslmode·네트워크 접근 설정을 적용합니다. [Cloudtype 내부 서비스 연결](https://docs.cloudtype.dev/ko/developers/connect).
4. PostgreSQL provider는 빌드 시 고정합니다. `prisma/postgresql/schema.prisma` 및 같은 폴더의 migration만 사용합니다. 기본 `db:migrate`는 개발 SQLite용이므로 Cloudtype에서 사용하지 않습니다.
5. 배포 전 백업과 SQL을 검토한 후 DB에 접근 가능한 릴리스 작업 또는 Cloudtype 터미널에서 **한 번** 실행합니다.

```sh
npm run env:check
npm run db:migrate:pg
```

Migration에는 필요한 DDL 권한과 직접 연결을 사용하고, 앱에는 업무에 필요한 권한을 부여합니다. pooler를 쓴다면 migration 작업 환경에만 직접 연결 DATABASE_URL을 별도로 주입합니다. 재시작 때 자동 migration을 실행하지 않으며 migrate dev/db push/reset 및 개발 Seed도 실행하지 않습니다.

초기 배포는 앱을 먼저 올린 뒤 터미널에서 migration할 수도 있으나, DB 준비 전까지 로그인/업무 요청을 받지 않도록 관리합니다. 기존 서비스 갱신은 릴리스 작업에서 호환 가능한 migration을 먼저 완료하고 앱을 교체합니다. Health는 DB migration 완료를 판정하지 않습니다.

첫 관리자만 준비할 때:

```sh
npm run db:admin
```

실행 환경에 INITIAL_ADMIN_EMAIL을 설정해야 합니다. 이후 실제 메일로 로그인해 광고주/사용자를 등록합니다. 개발 A/B Seed는 사용하지 않습니다.

## 배포 순서

1. 이 프로젝트와 새 배포 파일을 사용자의 저장소에 반영합니다.
2. Cloudtype에 Staging 환경과 PostgreSQL을 준비합니다.
3. 앱을 Dockerfile 방식으로 선택하고 루트·Port·Health Check를 지정합니다.
4. HTTPS 도메인/AUTH_URL, DB와 Resend 환경변수·시크릿을 등록합니다.
5. Docker 이미지를 빌드합니다. NODE_ENV/APP_ENV/GA4 Mock 기본값을 유지합니다.
6. DB migration을 명시적으로 수행하고 성공 여부를 확인합니다.
7. CMD로 앱을 실행하고 /api/health의 HTTP 200 및 {"status":"ok"}를 확인합니다.
8. 첫 관리자 생성 → 실제 로그인 메일 수신 → ADMIN/ADVERTISER 접근·Tenant Isolation → 관리자 System Readiness의 DB 상태를 확인합니다.
9. GA4/Meta가 Mock인지 확인하고 [STAGING_CHECKLIST.md](STAGING_CHECKLIST.md)의 외부 환경 검증을 완료합니다.

`/api/health`는 기존 liveness endpoint입니다. DB·Resend 접속 없이 정상 응답하며 로그인/DB readiness를 의미하지 않습니다. 앱 ENV 필수값 누락은 기존 시작 시 검증에서 실패합니다.

## 로컬 Docker 검증

Docker 엔진이 실행 중이고 필요한 런타임 변수를 셸에 안전하게 등록한 환경에서:

```sh
docker build -t intentbridge-staging .
docker run --rm --name intentbridge-staging -p 3000:3000 \
  -e APP_ENV=staging -e PORT=3000 -e GA4_DATA_MODE=mock \
  -e DATABASE_URL -e AUTH_SECRET -e AUTH_URL \
  -e RESEND_API_KEY -e AUTH_EMAIL_FROM -e RATE_LIMIT_STORE=database \
  intentbridge-staging
```

위 명령은 POSIX 셸 예시입니다. 실제 Secret 값을 명령 인자에 직접 적지 않습니다. 기존 로컬 서버가 3000을 사용한다면 포트 매핑을 별도로 지정합니다. Dockerfile의 HEALTHCHECK도 PORT를 사용하며, Cloudtype에는 별도로 `/api/health` 경로를 설정합니다.

## Docker 배포 준비 시점 검증 결과 (이전 작업)

- 기존 `npm run build` 성공. `APP_ENV=staging`, `GA4_DATA_MODE=mock`을 적용한 빌드도 성공했습니다.
- 실제 DB 연결 문자열 없이 PostgreSQL Prisma Client를 별도 임시 경로에서 생성했습니다. 로컬 개발용 Client는 교체하지 않았습니다.
- production 서버를 별도 `PORT=3127`로 실행하여 `/api/health` HTTP 200, `{ "status": "ok" }`, Cache-Control=no-store 및 Staging 빌드의 HSTS를 확인했습니다. 런타임 검증은 실제 Secret 없이 APP_ENV=development로 수행한 로컬 liveness 검사이며 DB 접속/실제 Staging 로그인 검증은 아닙니다. 검증 서버는 종료했고 기존 3000 서버는 유지했습니다.
- `docker build -t intentbridge-staging .`를 시도했으나 로컬 Docker Desktop Linux 엔진이 실행되어 있지 않아 빌드를 수행하지 못했습니다. Linux 이미지의 빌드/실행은 Cloudtype 또는 Docker 엔진 시작 후 검증해야 합니다.
- Cloudtype 실제 배포, PostgreSQL migration 적용, Resend 실제 발송은 수행하지 않았습니다. 변경 파일은 Dockerfile, .dockerignore, 이 문서뿐이며 앱 코드/package.json/Next 설정/Prisma 모델은 그대로입니다.


## Staging 이메일 로그인 진단 (2026-09-18)

### 확인된 흐름과 실패 지점

현재 설치된 next-auth 5.0.0-beta.32의 이메일 Provider는 DB Session과 함께 사용할 수 있습니다. 이 프로젝트는 Prisma를 사용하는 커스텀 Auth.js Adapter입니다. OAuth Account row는 이메일 로그인에 필요하지 않으며 현재 스키마에 Account 모델도 없습니다.

로그인 폼 → /api/auth/signin/resend POST → Origin/크기/Rate Limit/CSRF/이메일 검증 → Adapter.getUserByEmail → callbacks.signIn의 사용자·초대 검사 → Resend 발송과 VerificationToken 저장(병렬) → 이메일 callback의 토큰 1회 소비 → 허용 여부 재검사 → DB Session 생성 → signIn event에서 사용자 활성화/초대 수락 → 기존 역할별 진입 화면 순서입니다.

User가 없으면 signIn callback이 false를 반환하고 Auth.js가 AccessDenied를 발생시킵니다. 이때 메일 발송과 VerificationToken 저장은 둘 다 시작되지 않습니다. ACTIVE 사용자는 허용되며 INVITED는 미수락·미만료 초대가 있어야 합니다. DISABLED와 유효 초대가 없는 사용자는 계속 거부됩니다. Advertiser/Membership이 없는 최초 ADMIN도 이메일 로그인은 가능하며 로그인 후 관리 화면에서 구성합니다.

기존 auth.failed 로거가 원본 오류를 모두 AuthenticationError로 덮어써 원인을 숨겼습니다. 이 로깅 결함과 미등록 사용자 차단 경로를 코드/로컬 테스트로 확인했습니다. **현재 Cloudtype DB의 사용자 존재 여부는 직접 확인하지 않았습니다. Resend 요청 0건만으로 빈 DB라고 확정할 수 없습니다.** 사용자 조회 DB 오류, CSRF/설정/입력 오류 역시 발송 전에 실패할 수 있으므로 아래 진단과 requestId 로그로 구분합니다.

/api/bootstrap은 인증된 사용자의 워크스페이스 조회 API이며 최초 관리자 생성 API가 아닙니다. 호출하거나 브라우저로 열어도 관리자를 만들지 않습니다. 권한/테넌트 정책과 Provider, DB Session, Cookie, 토큰 해시, 만료·1회 사용 정책은 유지했습니다. redirect/authorized callback을 새로 추가하지 않았습니다.

### Cloudtype에서 실행할 순서

1. 수정된 Docker 이미지를 재배포합니다. 기존 Secret과 APP_ENV=staging, GA4_DATA_MODE=mock을 유지합니다. LOG_LEVEL=info로 설정하면 단계 로그를 볼 수 있습니다.
2. 앱 컨테이너 터미널에서 다음 읽기 전용 진단을 실행합니다. DATABASE_URL은 기존 런타임 설정을 그대로 사용합니다.

~~~sh
npm run env:check
npm run db:auth:check
~~~

진단은 User 전체/상태별/ACTIVE ADMIN, Advertiser, AdvertiserMember(Membership), VerificationToken, Session의 개수만 출력합니다. 토큰/세션 개수는 만료된 row를 포함한 총량이며 로그인의 성공 증거가 아닙니다. DB URL/비밀번호, 이메일, row ID, 토큰, Magic Link, API Key는 출력하지 않습니다. DB 쓰기나 메일 발송은 없습니다. DATABASE_URL이 없으면 진단은 실패하며 개발 DB로 대체하지 않습니다.

3. 대상 이메일 정책까지 확인하려면 Cloudtype 런타임 변수 AUTH_DIAGNOSTIC_EMAIL에 로그인하려는 이메일을 설정한 뒤 같은 명령을 실행합니다. INITIAL_ADMIN_EMAIL이 있다면 해당 값을 대신 사용할 수 있습니다. 출력은 target.exists/allowed/reason만 제공합니다. 미등록이면 user_not_registered입니다. 이메일 값을 공유 로그나 명령 인자에 적지 않습니다.
4. 정말 신규 DB이고 activeAdmins=0이라면, Cloudtype 환경변수 INITIAL_ADMIN_EMAIL에 소유자가 관리할 명시적 관리자 이메일을 설정하고 기존 명령을 한 번 실행합니다.

~~~sh
npm run db:admin
npm run db:auth:check
~~~

이 명령은 ACTIVE ADMIN을 생성할 뿐 인증 세션은 만들지 않습니다. 이후 동일 이메일로 로그인 링크를 요청하고 수신한 링크로 인증합니다. 이미 ACTIVE ADMIN이 있으면 명령은 거부되므로 기존 관리자의 사용자 관리/초대 기능을 사용합니다. 동일 이메일의 기존 INVITED/DISABLED row와 충돌해도 임의 승격하거나 삭제하지 않습니다. 기존 상태/관리자를 확인해야 합니다. 환경변수 설정만으로 관리자가 생기지 않으며 명령 실행이 필요합니다.

5. 최초 로그인 후 광고주/사용자/Membership을 기존 관리자 화면에서 준비합니다. INITIAL_ADMIN_EMAIL/AUTH_DIAGNOSTIC_EMAIL은 일회성 확인 후 환경변수에서 제거해도 됩니다. 임의 이메일 자동 ADMIN 생성, 개발 seed, db push/reset은 사용하지 않습니다. migration이 이미 성공했다면 초기 사용자 생성을 위해 다시 migration할 필요는 없습니다.

### 안전한 로그 해석

브라우저 네트워크 응답의 X-Request-ID와 서버 로그 requestId를 맞춰 확인합니다. requestId는 로그인 요청과 이메일 callback 각각 생성되며 두 요청은 서로 다른 ID입니다. 사용자 화면에는 기존 일반 실패 안내만 표시합니다.

| 로그 | 의미 |
| --- | --- |
| auth.signin.started | POST 로그인 요청 도착 |
| auth.user.lookup.started/completed | Adapter 이메일 사용자 조회 |
| auth.user.policy.lookup.started/completed | 상태/초대 조회 |
| auth.user.allowed / auth.user.denied | reason으로 허용/차단 원인 확인 |
| auth.email.send.started | Resend fetch 직전. 외부 서버의 수신을 보장하지 않음 |
| auth.email.send.completed / failed | 발송 요청 성공/실패. 실패 시 HTTP status(있을 때만) |
| auth.token.create.started/completed | VerificationToken 저장. 발송과 병렬이므로 발송 실패에도 row가 생길 수 있음 |
| auth.callback.started, auth.token.consume.*, auth.session.create.* | 링크 검증과 DB Session 생성 |
| auth.user.activate.*, auth.signin.completed | 사용자 활성화/초대 처리 완료 |
| auth.operation.failed / auth.failed | authStage, category, causeName, 허용된 databaseCode, requestId |

category/causeName/databaseCode는 고정 허용 목록만 기록합니다. 원본 Error message/stack/cause 객체, Resend 응답 본문, 요청 본문/헤더, 이메일과 링크는 기록하지 않습니다. P1001은 DB 접근 문제, P2021/P2022는 테이블/컬럼 불일치 확인 단서입니다. AccessDenied + user.policy + user_not_registered이면 최초 관리자/초대 준비 문제입니다. email.send.failed가 있으면 제공자 HTTP 상태 또는 네트워크 오류 분류를 확인합니다. rate limit/Origin 등의 거부는 auth.request.failed의 request.guard와 status로 확인합니다.

추가로 Auth.js가 반환한 읽기 전용 redirect 응답에 Request ID를 직접 쓰던 오류를 인증 Route 내부의 응답 복사로 수정했습니다. 만료/재사용 링크는 정상 오류 페이지로 이동하며 인증을 우회하지 않습니다.


### 이번 수정의 검증 범위

- npm test: 59/59 통과. 임시 SQLite DB에서 migration → 빈 DB 진단 → 기존 db:admin → ACTIVE ADMIN 확인 → 중복 생성 거부를 검증했습니다.
- 기존 브라우저 회귀 55개 통과. 새 재사용 링크 테스트에서 찾은 redirect 헤더 오류를 수정했고, 테스트의 기존 세션 영향을 제거한 뒤 최종 Auth/Security/Foundation/Login UX 20/20을 통과했습니다(새 이메일 진단 테스트 2개 포함).
- ACTIVE/미등록/유효·만료·없는 INVITED/DISABLED, 잘못된 이메일, 메일 제공자 성공·실패, VerificationToken 해시·생성·소비, DB Session, 링크 재사용 거부, ADMIN/ADVERTISER 진입, CSRF·Rate Limit·Tenant Isolation을 검증했습니다.
- npm run lint, npm run typecheck, 최종 npm run build 성공.
- 메일 제공자는 테스트용 로컬 캡처로 대체했습니다. 실제 Resend 전송, 실제 빈 PostgreSQL DB 및 Cloudtype DB 사용자 상태는 검증하지 않았습니다. Staging에서는 위 db:auth:check와 실제 이메일 로그인을 별도로 확인해야 합니다.

변경 파일: auth.ts, app/api/auth/[...nextauth]/route.ts, lib/auth-diagnostics.ts(신규), lib/server/auth-trace.ts(신규), lib/server/email.ts, lib/server/logger.ts, lib/server/request-context.ts, scripts/diagnose-auth.ts(신규), package.json, Dockerfile, tests/auth-diagnostics.test.ts(신규), tests/browser/auth-diagnostics.spec.ts(신규), CLOUDTYPE_DEPLOYMENT.md. 기존 최초 관리자 명령/Prisma schema·migration/업무 UI/권한 정책 파일은 변경하지 않았습니다.
