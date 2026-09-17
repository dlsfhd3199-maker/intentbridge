> Production Foundation 변경: PostgreSQL 전용 schema/migration, 원자적 문서 배치·idempotency, 공유 DB rate limit, nonce CSP/서버 환경 검증을 추가했습니다. 아래 이전 단계의 미구현 목록은 역사 기록입니다. 현재 배포 절차/한계는 [DEPLOYMENT.md](DEPLOYMENT.md)를 기준으로 확인하세요.

# IntentBridge · 실제 서비스 기반

## 로그인과 세션

Auth.js 5 (`next-auth` beta.32 고정 lockfile) + [Resend 이메일 Provider](https://authjs.dev/getting-started/providers/resend)를 사용합니다. 직접 비밀번호/JWT를 구현하지 않습니다. 등록된 ACTIVE 계정 또는 유효한 INVITED 계정만 이메일 로그인이 가능합니다. 가입 UI는 없습니다.

이메일 링크는 15분, DB 세션은 8시간입니다. Auth.js의 CSRF 검증·일회용 이메일 토큰·HttpOnly/SameSite 쿠키를 사용합니다. HTTPS 운영 환경에서는 Secure 쿠키를 사용합니다. 원문 세션 토큰은 쿠키에만 있으며 Prisma Adapter가 SHA-256으로 해시해 DB에 저장합니다. 이메일 확인 토큰은 Auth.js에서 해시하고, 초대 레코드도 해시만 저장합니다. 초대 상태는 7일 유효하며 실제 이메일 로그인 성공 시 ACTIVE로 바뀝니다. 초대 생성 자체는 메일을 발송하지 않습니다.

세션에는 권한을 신뢰 가능한 클라이언트 값으로 보관하지 않습니다. 매 요청에 DB의 현재 사용자 상태·Role·Membership을 조회합니다. 사용자 권한/광고주 연결/상태 변경 시 해당 사용자의 세션을 폐기합니다. 마지막 활성 ADMIN을 비활성화하거나 강등할 수 없습니다. 관리자도 INVITED 사용자를 이메일 확인 없이 ACTIVE로 전환할 수 없습니다.

## 권한과 Tenant Isolation

기존 `lib/permissions.ts`를 UI와 서버가 재사용합니다. 서버 공통 Guard는 `lib/server/authorization.ts`의 `requireUser`, `requireRole`, `requirePermission`, `requireAdvertiserAccess`입니다.

- ADMIN: 모든 활성 Workspace 조회, 광고주 생성/수정, 사용자 초대·연결·Role·상태 관리, Campaign/Operations/Connections/Settings 관리.
- ADVERTISER: 할당 Workspace의 Dashboard/Funnel/Performance/Campaign 조회/Report만 사용. 서버 쓰기·Connection Test·Data Mode 변경·Operations 관리 거부.
- `AdvertiserMember`는 `(userId, advertiserId)` 복합 키입니다. 여러 Workspace 소속을 저장할 수 있으며 현재 광고주 UI는 기본 할당 Workspace를 자동 선택합니다.
- 광고주 종속 조회는 Guard의 DB `where`에 활성 광고주와 `members.some.userId` 조건을 포함합니다. 클라이언트 advertiserId/role/쿠키는 권한 근거가 아닙니다.
- `proxy.ts`에서 페이지/RSC 스트리밍 전 실제 403 또는 로그인 리다이렉트 처리. Server Component도 별도로 Guard를 실행합니다. 모든 업무 API Route도 서버 Guard를 실행합니다.
- `/api/bootstrap`은 허용된 Workspace의 Mock fixture와 업무 문서만 반환합니다. 전체 A/B fixture JSON은 클라이언트 번들에 포함하지 않습니다. 비활성 Workspace는 제외합니다.
- 개발용 보기 전환은 `NODE_ENV=development`의 로그인한 관리자에게만 표시합니다. 서버 권한은 실제 세션 그대로이며 Production에서는 표시되지 않습니다.

## DB와 Repository

개발 DB는 Prisma 6.12 + SQLite입니다. `prisma/schema.prisma`, `prisma/migrations/`를 사용합니다. `DATABASE_URL=file:./dev.db`는 Prisma schema 디렉터리 기준입니다.

모델: User, Session, VerificationToken, Invitation, Advertiser, AdvertiserMember, Campaign, CampaignVersion, CampaignDraft, SavedSimulation, AutomationRule, OperationHistory, Alert, AdvertiserConnection, UserSetting, WorkspaceDocument, AuditLog.

업무 모델에는 advertiserId와 복합 식별자를 두고 Advertiser FK로 연결합니다. UI → 기존 Service → 메모리 호환 Adapter → 인증 API → Server Repository → Prisma 경로입니다. 기존 계산 로직을 변경하지 않았습니다. WorkspaceDocument는 기존 store 형식을 보존하고 같은 트랜잭션에서 업무 테이블로 반영합니다. revision을 이용해 다른 탭의 덮어쓰기를 409로 거부합니다.

Campaign/Version/Draft, Simulation 및 설정, Rule/History/Alert/안전 제한, UserSetting은 서버에 저장합니다. 아직 정규화되지 않은 업무 필드는 JSON payload로 보존합니다. 문서 단위 저장과 투영·Audit은 원자적입니다. 여러 문서에 걸친 Import/Operations는 순차 저장이므로 네트워크 장애 시 일부 문서가 먼저 반영될 수 있습니다. 운영 배포 전 전체 명령 트랜잭션으로 확장해야 합니다.

LocalStorage는 인증/업무 저장에 사용하지 않습니다. 호환 Adapter의 브라우저 캐시는 메모리뿐입니다. 기존 동기 계산과 Store 계약을 유지하며 DB 쓰기를 직렬 큐로 전달합니다. 저장 중/실패는 공통 하단 상태에 표시하고, 실패 시 재시도·미저장 JSON 보관·새 창 로그인 기능을 제공합니다. 저장 실패를 서버 완료로 표시하지 않습니다.

관리 설정/Connections의 `기존 브라우저 데이터 검토`는 알려진 업무 키만 읽고 기존 Backup 검증·Merge/Replace Preview를 거쳐 DB로 이전합니다. 서버 저장이 확인된 후 해당 이전 키만 제거합니다. 기존 Backup JSON Import/Export도 유지합니다. 원문 인증/Secret 키는 수집하지 않습니다.

## API·GA4·Audit

Mutation API는 동일 Origin 확인, 서버 권한, Workspace 범위, payload 검증, revision 확인을 수행합니다. Campaign/Simulation 등의 advertiserId 변조와 Secret 필드 저장을 거부합니다. 클라이언트에는 안전한 오류만 반환합니다.

`/api/ga4`도 인증·Workspace Guard를 거칩니다. POST 연결 테스트 및 mode override는 ADMIN only입니다. 광고주 응답은 Property ID 등 연결 메타데이터를 제거합니다. 저장된 AdvertiserConnection의 GA4 Property ID를 서버 설정에 매핑하며 없으면 기존 서버 환경변수 매핑을 유지합니다. Data Mode 변경은 DB 및 Audit에 저장합니다. 기존 로컬 개발 전용 실제 GA4 제한을 유지하며 Meta API 및 실계정 검증은 추가하지 않았습니다.

Service Account 비밀은 서버 파일/환경변수에만 둡니다. 일반 DB 열, LocalStorage, NEXT_PUBLIC 변수에 저장하지 않습니다.

AuditLog에는 actorUserId, advertiserId, action, resource, before/after JSON, createdAt을 기록합니다. 사용자/멤버십·광고주·Campaign·Operations Mock 적용/롤백·Connection 변경이 대상입니다. Operations History는 제품 운영 이력, Audit은 서버 관리자 변경 이력입니다. ADMIN만 최근 100건을 조회합니다.

## 개발 실행

```powershell
npm ci
$env:DATABASE_URL='file:./dev.db'
$env:RUST_LOG='info'
npm run db:generate
npm run db:migrate
npm run db:seed
```

Seed는 A/B Mock 광고주와 `admin@intentbridge.test`, `a@intentbridge.test`, `b@intentbridge.test` 사용자만 만들며 비밀번호/Secret은 없습니다. `.test` 주소는 실제 메일 수신용이 아닙니다. 실제 개발 계정으로 실행할 때는 새 DB에 Seed 대신 아래 초기 관리자 생성 절차를 사용합니다. Workspace가 없으면 로그인 후 최초 Workspace 생성 화면을 표시합니다.

```powershell
$env:INITIAL_ADMIN_EMAIL='your-email@your-domain.example'
npm run db:admin
```

서버 환경에 `AUTH_SECRET`(충분히 긴 랜덤 값), `AUTH_URL`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`을 설정합니다. `.env.example`은 변수 안내이며 실제 값을 커밋하지 않습니다. Resend에서 발신 도메인 검증이 필요합니다. Prisma CLI는 `.env`를 사용하므로 `.env.local`만 사용하는 경우 DATABASE_URL을 터미널 환경에도 설정하세요. `npm run dev`로 시작합니다. 개발 환경에서 AUTH_SECRET이 없으면 프로세스별 임시 난수를 사용하므로 재시작 시 세션이 무효화됩니다. Production은 고정 서버 Secret이 필수입니다.

## 검증

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:ui`.

브라우저 테스트는 별도 `prisma/browser-test.db`, localhost:3100 앱, 127.0.0.1:3101 테스트 메일 수신기를 사용합니다. `scripts/test-mail-preload.cjs`는 테스트 프로세스에서만 Resend 전송을 로컬 메일 수신기로 치환합니다. 앱에는 인증 우회 API가 없습니다. 실제 Auth.js CSRF → 이메일 토큰 확인 → DB 세션 흐름으로 로그인합니다. 원문 이메일 토큰/세션을 파일이나 로그에 기록하지 않습니다. 테스트 runner는 업무 데이터만 테스트 DB에서 초기화합니다. 이 수신기는 개발·운영 서버 실행 명령에 포함하지 마세요.

## 실제 운영 전 남은 일

- 운영용 이메일 도메인·Resend 설정, HTTPS/AUTH_URL/고정 AUTH_SECRET, 관리자 계정 프로비저닝.
- Auth.js 5 beta 의존성 릴리스 검토 및 운영 인증 보안 검수. Prisma SQLite 파일은 단일 인스턴스 개발용입니다.
- PostgreSQL provider 및 별도 초기 migration 생성/검증, 데이터 이관·백업/복구·접속 권한·연결 풀. SQLite SQL migration을 PostgreSQL에 그대로 적용하지 않습니다.
- 분산 rate limit/WAF, 이메일 남용 방지, 만료 Session/VerificationToken 정리, Audit 보존/접근/용량 정책, 장애 모니터링.
- 문서 간 Import/Automation 원자적 명령 처리 및 대량 데이터 페이지네이션. DB payload의 정규화와 DB enum/check 제약 강화.
- 쿠키/보안 헤더/CSP 및 프록시 신뢰 설정을 실제 배포 도메인에서 점검. 실제 GA4 production 활성화와 Meta 연결은 별도 단계입니다.

## 이번 검증 결과 (2026-09-17)

- 기존 Unit 51/51 통과. 기존 Browser 37/37 통과. 추가 보안·관리자 UI 7/7 통과(총 Browser 44개, 전체 43개 실행 + 추가 UI 1개 실행).
- 미인증/위조 Role 쿠키, ADMIN A/B, A→B·B→A IDOR, URL·직접 API, 쓰기 권한, GA4 Connection/Mode, 세션 해시·만료·비활성화, 초대 활성화, 마지막 관리자 보호, CSRF, revision 충돌, DB 저장·Audit, 관리자 UI를 검증했습니다.
- 타입 검사·Lint·Production build 통과. 의존성 audit 0 vulnerabilities. 실제 Resend/GA4/Meta API 호출 없이 검증했습니다.
- reference HTML SHA-256: `280954424FA392D46B7F93656ADC41141831EB92F25AD8FFB1EB0C4F5E087EDA` (변경 없음).
