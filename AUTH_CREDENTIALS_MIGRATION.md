# 이메일·비밀번호 회원가입 / 승인 / 로그인

이 문서는 기존 Magic Link 인증 안내보다 우선합니다. 기능·대시보드·광고 Connector·Permission/Tenant Isolation은 유지합니다.

## 인증과 데이터

- Auth.js 5.0.0-beta.32 Credentials Provider를 사용합니다. Credentials는 JWT 전략을 요구하므로 Auth.js 기본 암호화 JWT/HttpOnly/SameSite/Secure 쿠키/CSRF/signOut을 사용합니다. 직접 쿠키나 JWT 인코더를 만들지 않았습니다. [Auth.js Credentials 문서](https://authjs.dev/reference/core/providers/credentials)
- 기존 Session 테이블에 JWT 내부의 무작위 sessionId를 SHA-256 해시로 저장합니다. JWT 원문·비밀번호·원본 sessionId는 DB/Audit/로그에 기록하지 않습니다. 매 세션 조회 시 해당 row, 만료, 현재 User ACTIVE 상태를 검사합니다. 권한 변경/비활성화 시 기존 session.deleteMany 로직으로 즉시 취소됩니다. 로그아웃은 Auth.js signOut event에서 해당 row를 삭제합니다. 서버 측 수명은 로그인부터 최대 8시간입니다.
- 기존 불투명 DB Session 쿠키는 새 JWT 방식으로 해석할 수 없으므로 배포 후 재로그인이 필요합니다. 기존 Session row는 migration에서 삭제하지 않으며, 해당 row만으로 새 세션을 얻을 수 없습니다.
- passwordHash nullable String만 추가합니다. 기존 User/Advertiser/Membership/Session/VerificationToken/Invitation 데이터는 삭제·초기화하지 않습니다. 신규 회원가입은 서버에서 PENDING + ADVERTISER를 강제하며 Membership을 생성하지 않습니다.
- 비밀번호는 @node-rs/argon2의 Argon2id, 메모리 19MiB, 반복 2, 병렬도 1, 무작위 salt로 해싱합니다. 8~128자, 12자 이상 권장. 반복 문자/일부 흔한 비밀번호는 거부합니다. 비밀번호와 해시는 사용자 응답/Audit/일반 로그에 포함하지 않습니다.
- 비밀번호 검증에 성공한 사용자에게만 PENDING/DISABLED 상태를 안내합니다. 미등록·틀린 비밀번호·비밀번호 미설정 계정은 같은 오류입니다. 가입은 요구사항대로 중복 이메일을 명시적으로 안내합니다.

## 사용 흐름

1. /login에서 회원가입으로 전환 → 이름·이메일·비밀번호·확인 입력.
2. PENDING 저장 → 완료 안내. 로그인 세션/광고주 연결 없음.
3. ADMIN의 설정 > 사용자 관리에서 승인 대기 필터 → 승인 및 광고주 연결 → 활성 광고주 선택.
4. Serializable transaction 안에서 ACTIVE, ADVERTISER Membership, user.approved Audit을 함께 저장합니다. 실패하면 전부 롤백됩니다. 승인 대기 사용자는 일반 편집 경로로 승인할 수 없습니다.
5. ACTIVE 사용자만 로그인 가능. ADVERTISER는 연결된 활성 Workspace, ADMIN은 전체 Workspace에 접근합니다.
6. 거절은 DISABLED로 보관하며 user.rejected Audit을 남깁니다. 비활성화는 user.disabled Audit과 세션 취소를 수행합니다. 마지막 활성 관리자 보호는 유지합니다.

가입 POST는 동일 Origin 및 JSON 입력 제한, IP/이메일 Rate Limit을 검사합니다. 입력에 role/advertiserId 등을 주입하면 거부합니다. Credentials callback에도 기존 로그인 IP/이메일 Rate Limit을 적용합니다. 기본 분당 가입 IP 10회/이메일 5회, 로그인 IP 30회/이메일 5회입니다. 프록시 설정과 공유 DB Rate Limit은 기존 배포 정책을 유지합니다.

## Cloudtype 배포 / Migration

기존 DB를 백업한 뒤 신규 이미지를 빌드하고, 전환 중 로그인 요청을 받지 않도록 관리하며 다음 명령을 앱 컨테이너 또는 같은 이미지의 릴리스 작업에서 실행합니다.

~~~sh
npm run env:check
npm run db:migrate:pg
npm run db:auth:check
~~~

신규 migration: prisma/postgresql/migrations/202609180001_password_signup_approval/migration.sql. SQL은 User.passwordHash TEXT nullable 추가뿐입니다. SQLite 개발용 migration도 같은 이름으로 추가했습니다. Staging에서 db:migrate(개발 SQLite)/db push/reset/개발 seed를 실행하지 않습니다. Prisma PostgreSQL Client는 Docker build의 db:generate:pg에서 생성됩니다. Migration은 앱 시작마다 자동 실행하지 않습니다.

## 최초 ADMIN 및 기존 계정

Cloudtype Secret 환경변수에 INITIAL_ADMIN_EMAIL 및 INITIAL_ADMIN_PASSWORD(12자 이상)를 설정한 뒤:

~~~sh
npm run db:admin
npm run db:auth:check
~~~

- ADMIN이 없는 DB에서는 명시한 이메일로 ACTIVE ADMIN을 생성합니다.
- 기존 유일한 ACTIVE ADMIN이며 passwordHash가 없는 동일 이메일에는 비밀번호만 초기 설정하고 기존 세션을 취소합니다.
- 다른 계정 승격, 기존 비밀번호 덮어쓰기, 두 번째 초기 관리자 생성은 거부합니다. 완료 후 INITIAL_ADMIN_PASSWORD를 환경변수에서 제거합니다.
- 이미 Magic Link로 생성된 일반 계정은 이메일 중복 회원가입으로 비밀번호를 덮어쓸 수 없습니다. 서버 운영자가 대상 본인을 확인한 후 AUTH_PASSWORD_EMAIL / AUTH_INITIAL_PASSWORD(12자 이상)를 일회성 Secret으로 주입하고 아래 명령으로 비밀번호 미설정 계정만 초기 설정할 수 있습니다. 상태/역할/Membership은 바뀌지 않으며 기존 비밀번호 재설정 명령이 아닙니다. 설정 후 일회성 변수를 제거합니다.

~~~sh
npm run db:password
~~~

기존 INVITED도 ACTIVE 전에는 로그인할 수 없습니다. 비밀번호 초기 설정 후 ADMIN의 전체 목록에서 승인·연결을 진행합니다. 기존 ADMIN/사용자의 이메일 소유 확인과 일회성 비밀번호 전달은 운영자가 별도로 수행합니다. 일반 신규 사용자는 이 운영 절차 없이 회원가입 UI를 사용합니다. Production 기본 비밀번호는 없습니다.

## 환경변수

계속 필수: APP_ENV=staging, DATABASE_URL, AUTH_SECRET, HTTPS AUTH_URL. GA4_DATA_MODE=mock 유지. RATE_LIMIT_STORE=database 권장(Production 필수), LOG_LEVEL=info. PORT/Docker CMD 변경 없음.

Resend의 RESEND_API_KEY/AUTH_RESEND_KEY, AUTH_EMAIL_FROM은 선택 사항입니다. 로그인과 회원가입에서 Resend를 호출하지 않습니다. 기존 lib/server/email.ts 발송 모듈과 lib/server/legacy-email-adapter.ts는 보존하지만 Provider는 등록하지 않았습니다. 과거 Magic Link endpoint/토큰으로 우회 로그인할 수 없습니다. 향후 이메일 인증/비밀번호 재설정/승인·초대 알림을 연결할 기반이며, 이번 작업에서 자동 알림·비밀번호 재설정 화면을 제공하지 않습니다.

추가 선택 변수: RATE_LIMIT_SIGNUP_IP, RATE_LIMIT_SIGNUP_EMAIL. 일회성 Secret: INITIAL_ADMIN_PASSWORD, AUTH_INITIAL_PASSWORD. NEXT_PUBLIC_ 접두사, Docker ARG, 코드, 문서, 명령 인자에 실제 Secret 값을 넣지 않습니다. 테스트 서버에서만 임의의 DEV_SEED_PASSWORD를 생성하여 주입하며 Staging/Production seed는 차단됩니다.

Audit action: signup, user.approved, user.rejected, user.disabled, login.success, login.failed. login.failed에는 고정된 사유만 기록합니다. 비밀번호/해시/JWT/세션 ID를 기록하지 않습니다. auth 진단은 기존 requestId와 안전한 분류만 사용합니다.


## 검증 결과

- npm test: 62/62 통과. Argon2id/잘못된 비밀번호/안전한 로그/최초 관리자 및 기존 계정 초기 설정과 재실행 거부를 포함합니다.
- 전체 브라우저 회귀: 58/58 통과. 최종 UI 직접 로그인과 기존 INVITED 승인 호환 처리 후 인증·보안·Foundation·Login UX 21/21을 추가 검증했습니다.
- npm run build 성공, TypeScript/lint 성공. PostgreSQL schema validate 성공.
- 390/768/1024/1366px 회원가입 레이아웃과 키보드·보기/숨기기·중복 제출 차단 확인. Reference HTML SHA256 유지.
- 테스트는 로컬 SQLite와 로컬 메일 캡처에서 실행했습니다. 테스트 런타임의 Resend 키/발신자는 비워 두었고, 메일 서버 실패 상태에서도 Credentials 로그인이 통과했습니다. 실제 외부 API 호출 없음.
- Cloudtype 실제 배포, 실제 PostgreSQL migration 적용 및 Linux Docker 실행은 수행하지 않았습니다. 실제 Staging에서는 위 명령을 순서대로 적용한 후 관리자 로그인과 신규 가입 승인 흐름을 확인하세요.
