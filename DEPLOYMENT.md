# IntentBridge Staging / Production 배포

외부 서버·DB·Resend 계정을 자동 생성하거나 실제 배포하지 않습니다. 아래는 준비된 코드와 실제 환경에서 수행할 절차입니다. Meta, Campaign Write, Operations는 MOCK입니다. GA4 실제 조회는 로컬 개발 환경 제한을 유지합니다.

## 환경 분리

| 항목 | Development | Staging | Production |
|---|---|---|---|
| APP_ENV | development | staging | production |
| Database | SQLite | PostgreSQL | 별도 PostgreSQL |
| AUTH_URL | localhost HTTP 가능 | 외부 HTTPS | 외부 HTTPS |
| Email | 구성 시 사용 | 검증된 Resend 발신 도메인 | 별도 운영 키·도메인 |
| Log | info/warn/error | info/warn/error | info/warn/error |
| Rate Limit | memory | 단일 프로세스 memory 또는 database | 공유 database 필수 |
| Cookie | Auth.js 로컬 기본값 | Secure/HttpOnly/SameSite | Secure/HttpOnly/SameSite |

APP_ENV가 없으면 NODE_ENV=production은 production으로 간주합니다. Staging/Production 시작 시 PostgreSQL DATABASE_URL, 32자 이상 AUTH_SECRET, HTTPS AUTH_URL, RESEND_API_KEY, AUTH_EMAIL_FROM이 없으면 Configuration Error로 실패합니다. 오류에는 변수명만 포함합니다. `npm run env:check`로 사전 검증합니다.

## 배포 순서

1. **DB 준비:** 환경별 PostgreSQL과 최소 권한 애플리케이션 사용자를 만듭니다. migration 작업에는 별도 DDL 권한을 부여합니다. 공급자가 pooler/direct 연결을 구분하면 migration job에 직접 연결 URL을 별도 주입합니다.
2. **Environment:** `.env.example`의 이름을 기준으로 Hosting Secret에 값을 주입합니다. 연결 문자열/Secret을 코드나 NEXT_PUBLIC에 넣지 않습니다.
3. **Migration Deploy:** `npm ci` → `npm run db:generate:pg` → `npm run db:migrate:pg`. 명시적인 릴리스 작업에서만 실행합니다. start에는 migration/seed가 없습니다.
4. **Auth Secret:** 환경별 충분히 긴 랜덤 Secret을 Secret Manager에서 생성합니다. 회전 시 기존 로그인 링크·세션의 영향을 확인합니다.
5. **Resend:** 발신 도메인 DNS 검증 후 RESEND_API_KEY/AUTH_EMAIL_FROM을 설정합니다. AUTH_RESEND_KEY는 이전 버전 호환용입니다. 실제 수신 계정으로 메일 배달을 검증합니다. 메일에는 IntentBridge·로그인 버튼·15분 유효기간만 안내합니다.
6. **Domain:** 외부 서비스 URL과 AUTH_URL을 일치시킵니다.
7. **HTTPS:** Hosting/Reverse Proxy가 인증서·HTTP→HTTPS를 제공합니다. 앱은 인증서를 구현하지 않습니다. Staging/Production 응답에는 HSTS가 적용됩니다.
8. **Build:** `npm run env:check`, `npm run db:generate:pg`, `npm run build`. 같은 APP_ENV와 PostgreSQL용 생성 Client로 빌드합니다.
9. **Start:** `npm start`. 빌드 후 SQLite generate를 실행하지 않습니다. 적절한 process manager로 단일/다중 인스턴스를 관리합니다.
10. **Health:** `/api/health`는 `{status:"ok"}`만 반환하는 liveness입니다. DB 상태를 뜻하지 않습니다. 관리 설정의 System Readiness에서 DB SELECT 1 및 인증·이메일 구성 여부를 확인합니다. CONFIGURED는 실제 메일 배달 성공을 뜻하지 않습니다.
11. **Admin Login:** 서버 환경의 INITIAL_ADMIN_EMAIL을 설정하고 `npm run db:admin`을 명시적으로 한 번 실행합니다. 활성 관리자가 있으면 차단합니다. 로그인 후 빈 DB에서는 첫 Workspace를 생성합니다. 생성자 Admin Membership/Connection/Audit은 함께 저장됩니다.
12. **Advertiser Isolation:** ADMIN·A·B 계정으로 URL/API/summary/documents 양방향 접근을 검증합니다. 비활성화 후 기존 세션과 재로그인이 차단되어야 합니다. 마지막 활성 ADMIN 변경은 거부됩니다.
13. **GA4:** Staging에서 Mock과 API 권한을 검증합니다. 실제 GA4 호출 확대·Meta 연결·실제 캠페인 실행은 별도 단계입니다.

## Prisma 전략

개발은 `prisma/schema.prisma`와 SQLite migration을 유지하고 `npm run db:dev`(migrate dev)를 사용합니다. 배포는 `prisma/postgresql/schema.prisma`와 별도의 PostgreSQL migration을 사용합니다. provider를 런타임에서 전환하지 않습니다. 두 모델의 동일성을 테스트합니다.

`db:migrate:pg`는 `prisma migrate deploy --schema prisma/postgresql/schema.prisma`입니다. 운영에서 migrate dev/db push/reset을 사용하지 않습니다. 변경 시 각 provider의 migration을 별도 생성·검토하고 빈 PG/기존 PG 모두에 적용 검증합니다. SQLite SQL을 PG에 복사하지 않습니다. 기존 SQLite 실데이터 이전은 별도 검증된 export/ETL 작업이 필요합니다.

개발 Seed는 APP_ENV=development에서만 허용합니다. Staging 테스트 데이터는 관리자 UI에서 명시적으로 생성·초대합니다. Staging/Production 자동 Seed는 없습니다. 실제 이메일/비밀번호/Secret을 Seed 소스에 넣지 않습니다.

## 원자성·중복·응답

- Invite+Membership+Audit, Advertiser+Admin Membership+Connection+Audit, Campaign+Version, Operation Apply/Rollback+Campaign+History+Alert, 전체 Import 문서는 Serializable transaction으로 저장합니다. 실패 시 해당 배치 전체가 롤백됩니다.
- 브라우저는 중요한 명령을 직렬 처리하고 서버 저장 성공 후 상태·성공 메시지를 표시합니다. 기존 Operation 중복/최신 상태 검사를 유지합니다.
- MutationReceipt에 actor/scope/key 해시·payload hash·결과를 같은 transaction으로 기록합니다. 같은 key/payload 재시도는 이전 결과를 반환하며 다른 payload는 409입니다. 네트워크 실패 재시도는 원본 배치와 키를 유지합니다. 원문 요청 키는 DB에 저장하지 않습니다.
- 서버 입력은 기존 도메인 Schema/type guard와 중앙 길이/JSON/범위 검증을 재사용합니다. 잘못된 광고주·이메일·예산·Secret 필드·revision을 거부합니다. 최대 요청은 5 MB, 배치는 500문서입니다.
- 마지막 관리자 보호는 Serializable transaction의 충돌 재시도를 포함합니다. ACTIVE 이메일 중복 초대는 409 및 기존 사용자 Membership 변경 안내를 반환합니다.

## Rate Limit·IP·로그

분당 기본값: Email 5, IP 30, Invite 20, GA4 Test 10, Import 10, Campaign 신규 저장 120, Operation 신규 적용 120. `.env.example`의 RATE_LIMIT_*로 조절합니다. 서버에서 검사하며 개별 초안 입력을 신규 캠페인으로 세지 않습니다.

Memory RateLimitStore는 단일 프로세스 Staging용입니다. Production은 `RATE_LIMIT_STORE=database`로 PostgreSQL 원자적 upsert를 공유합니다. Redis 확장 시 RateLimitStore.consume 계약과 원자적 증가/만료를 유지합니다. 저장소 장애 때 요청을 무제한 허용하지 않습니다.

TRUST_PROXY_IP=true는 ingress가 X-Forwarded-For를 덮어쓰고 원본 직접 접속을 차단할 때만 사용합니다. 기본 false는 위조 IP를 신뢰하지 않고 공용 버킷으로 보수적으로 제한합니다. 이메일/IP 키는 Secret 기반 HMAC으로 만들고 원문 IP를 저장하지 않습니다.

Logger는 allowlist의 event/level/requestId/errorType/status만 기록합니다. Error.message/stack, body, URL query, 이메일, Cookie/Authorization, 연결 문자열은 기록하지 않습니다. 중요한 API의 X-Request-ID와 Audit.requestId로 추적합니다. **Hosting/프록시 access log에서도 Auth callback query string과 인증 헤더를 제거해야 합니다.** 앱 Logger는 공급자의 access log를 제어하지 못합니다.

## 보안 헤더와 성능

CSP는 요청별 nonce/self이며 운영 script에 unsafe-inline/unsafe-eval을 허용하지 않습니다. 기존 차트/레이아웃을 위해 inline style만 유지합니다. Resend/GA4는 서버 호출이므로 브라우저 외부 connect-src가 필요하지 않습니다. Referrer-Policy=no-referrer, nosniff, Permissions-Policy, frame 제한을 적용합니다. 이메일 링크 토큰이 Referer로 전달되지 않도록 합니다.

초기 Bootstrap은 Workspace fixture/사용자 설정만 반환합니다. Dashboard는 기존 계산 함수를 서버 request-local scope에서 실행한 요약을 사용합니다. 관리자 요약은 Workspace별 API/쿼리 대신 일괄 조회합니다. 편집 문서는 선택한 Workspace에서 지연 조회하고 Backup 화면은 전체 대상 문서를 준비합니다. 변경 데이터를 createMany로 투영합니다.

Users/Advertisers/Audit는 limit(기본 50/최대 100), after cursor를 지원합니다. 현재 관리 UI는 첫 페이지입니다. 초기 Workspace catalog/요약은 최대 100개이며 대규모 운영 전 다음 페이지 UI를 확장해야 합니다. JSON 호환 문서는 편집 시 전체를 로드하므로 대규모 Campaign/History는 행 단위 편집으로 추가 전환해야 합니다. 세션 사용자/만료, Membership 광고주, User 상태/Role, Audit 날짜, Receipt/RateBucket 만료에 index를 추가하고 업무 advertiserId 복합 PK를 재사용합니다.

## 백업·보존·복구

JSON Backup은 사용자 업무 내보내기이며 전체 DB 백업이 아닙니다. PostgreSQL 공급자의 자동 Backup/PITR, 암호화, 별도 보관과 복구 리허설이 필요합니다. migration 전 스냅샷을 확보하고 장애 시 이전 앱 버전 또는 검토된 forward fix를 적용합니다. 임의 reset을 하지 않습니다.

정책 기본값은 Audit 365일, Alert 90일입니다. 자동 삭제는 구현하지 않았습니다. Operation History/Version은 Rollback 참조와 함께 보존하고 단독 삭제하지 않습니다. MutationReceipt는 최소 7일 보존하며 만료 Session/VerificationToken/RateBucket 정리는 별도 운영 작업으로 구성합니다. 삭제 전 정책·참조·복원 요구를 확인합니다.

공식 자료: [Prisma migration](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production), [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy), [Auth.js Resend](https://authjs.dev/getting-started/providers/resend).

## 이번 로컬 검증 범위

PostgreSQL schema validate와 별도 경로 Client 생성, PostgreSQL provider Client로 build의 타입 호환성을 확인했습니다. 실행 중인 Windows 개발 서버가 기본 Client DLL을 잠그고 있어 별도 임시 경로에서 생성 검증 후 개발용 SQLite provider로 복원했습니다. 개발 서버를 중지한 상태에서 `db:generate`를 실행하면 DLL 교체 충돌을 피할 수 있습니다.

실제 PostgreSQL 서버/migration deploy, 외부 Hosting 배포, 실메일 수신, HTTPS Cookie, 공유 Store 동시성 검증은 미실행입니다. [보안 검수](SECURITY_AUDIT.md)의 범위와 실제 환경 체크리스트를 구분하세요.
