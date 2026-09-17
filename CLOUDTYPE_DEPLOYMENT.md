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

## 이번 검증 결과

- 기존 `npm run build` 성공. `APP_ENV=staging`, `GA4_DATA_MODE=mock`을 적용한 빌드도 성공했습니다.
- 실제 DB 연결 문자열 없이 PostgreSQL Prisma Client를 별도 임시 경로에서 생성했습니다. 로컬 개발용 Client는 교체하지 않았습니다.
- production 서버를 별도 `PORT=3127`로 실행하여 `/api/health` HTTP 200, `{ "status": "ok" }`, Cache-Control=no-store 및 Staging 빌드의 HSTS를 확인했습니다. 런타임 검증은 실제 Secret 없이 APP_ENV=development로 수행한 로컬 liveness 검사이며 DB 접속/실제 Staging 로그인 검증은 아닙니다. 검증 서버는 종료했고 기존 3000 서버는 유지했습니다.
- `docker build -t intentbridge-staging .`를 시도했으나 로컬 Docker Desktop Linux 엔진이 실행되어 있지 않아 빌드를 수행하지 못했습니다. Linux 이미지의 빌드/실행은 Cloudtype 또는 Docker 엔진 시작 후 검증해야 합니다.
- Cloudtype 실제 배포, PostgreSQL migration 적용, Resend 실제 발송은 수행하지 않았습니다. 변경 파일은 Dockerfile, .dockerignore, 이 문서뿐이며 앱 코드/package.json/Next 설정/Prisma 모델은 그대로입니다.
