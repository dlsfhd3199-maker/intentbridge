# IntentBridge 개발 완료 및 Git 반영 규칙

## 적용 단계: DEVELOPMENT / STAGING PHASE

현재 플랫폼 구동 데이터와 Mock/Demo 중심 개발에 적용한다. 사용자 작업별 제한을 우선한다. 기존 GitHub Actions → Cloudtype Staging Pipeline만 사용한다. 실제 GA4/광고 매체 데이터 저장 또는 실제 Campaign Write API를 도입하기 전에 Production 수준 정책으로 강화한다. 현재 DB에도 계정·권한·설정 데이터가 있으므로 무손실을 가정하거나 초기화하지 않는다.

## 시작 및 변경 소유권

`git status --short`, `git branch --show-current`, `git rev-parse HEAD`로 시작 상태를 기록한다. 기존 staged/unstaged/untracked 변경을 구분하고 기존 diff를 먼저 확인한다. 사용자 변경을 덮어쓰거나 자신의 변경으로 간주하지 않는다. 안전하게 분리할 수 없으면 commit/push를 보류한다. `git reset --hard`, `git clean -fd`, 대량 checkout/restore는 명시적 요청 없이 금지한다.

## 배포 결정

파일 경로만이 아니라 실제 diff의 의미를 검토한다. CI의 scripts/deployment-policy.mjs 결과와 이 지침 중 더 엄격한 결정을 따른다. 분류를 쪼개거나 검사를 완화하여 검토를 우회하지 않는다.

### AUTO

UI/CSS/Layout/Responsive/Copy, Public Website·Public Route·일반 페이지, Dashboard/Journey/Performance/Campaign/Operations/Reports/Connections, Demo Connector·Dataset, Notification/Search/Onboarding, 일반 Component/Business Logic, 비파괴 Read API, 기존 보안 경계를 유지하는 Tenant-safe Create/Update·설정 저장 API, Export/Report, Mock/Demo 기능. `lib/**`, `app/api/**` 경로 자체는 수동 검토 사유가 아니다. LOW/MEDIUM은 참고 진단일 뿐 배포 결정은 AUTO다.

### MANUAL_REVIEW — 아래 5개 범주만

1. **DESTRUCTIVE_DATABASE**: DROP/TRUNCATE/DELETE ALL, column/table 제거, 대량 UPDATE/DELETE, DB reset, 데이터 손실 가능성 또는 분석할 수 없는 migration/schema 변경.
2. **AUTHENTICATION**: Auth.js 핵심 설정, Credentials, 비밀번호 해시, Session 생성/검증, 로그인/가입 보안, 인증 Guard 핵심 동작.
3. **AUTHORIZATION_TENANT**: Role/Permission, Membership, Tenant Isolation, 광고주 접근 범위, 관리자 승인 권한.
4. **SECRET_ENVIRONMENT**: 환경변수 구조, DB URL/인증 Secret/API Key 참조, Cloudtype Secret 전달 방식. 실제 credential commit은 아래 BLOCKED다.
5. **DEPLOYMENT_INFRASTRUCTURE**: Workflow/Docker/Cloudtype/deployment scripts/CI 보안, 의존성·빌드·테스트 실행 설정, AGENTS.md/Git 정책 및 AUTO_DEPLOYMENT.md 실행 규칙.

Public Route 추가 자체는 AUTO. proxy/중앙 권한 구현 등에서 보호 정책을 바꾸면 수동 검토한다. 일반 API에 기존 requireAdvertiserAccess 등을 그대로 적용하는 것은 AUTO. 보안 경계 변경을 일반 업무 변경으로 분류하지 않는다. CI의 내용 검사에는 한계가 있어 개발자가 실제 접근 범위를 검토해야 한다.

MANUAL_REVIEW는 구현 → 검증 → 영향 보고까지 진행하고 **commit/push를 보류**한다. 해당 변경에 대한 사용자 명시적 승인 후 동일한 Git/Secret 검사를 거쳐 반영한다. 이번 정책 단순화 작업 자체도 MANUAL_REVIEW이며, 사용자 승인 없이 commit/push하지 않는다. 일반 운영 규칙 동의는 미래 민감 변경의 포괄 승인이 아니다.

### BLOCKED — 승인으로 해제 불가

실제 Secret/Private Key 및 미해결 Secret 후보, 필수 테스트·빌드·Tenant Isolation 검증 실패, 분석 실패 SQL에 명백한 destructive operation 포함, 잘못된 baseline/비조상 이력, 예상 저장소가 아닌 origin, 강제 push가 필요한 상황. 원인을 수정하고 재검증해야 한다. 미실행/확인 불가 검사는 PASS가 아니다.

## Migration

Detection을 유지한다. 새 migration SQL이 제한된 allowlist(새 table, nullable column, 일반 index)에 맞으면 NON_DESTRUCTIVE로 AUTO 가능하다. NOT NULL 추가, rename, 기존 migration 편집/삭제, 데이터 변경 및 분석 불가 구문은 수동 검토한다. SQL을 분석하지 못했으며 destructive operation도 포함하면 BLOCKED다. Auth/Role/Membership schema 변경은 additive여도 수동 검토한다. schema만 바꾸거나 SQL과의 정합성을 확인할 수 없으면 AUTO 금지.

**분류 AUTO는 DB 변경 실행 승인이 아니다.** 현재 pipeline은 staging migrate/seed/reset을 실행하지 않는다. additive schema를 사용하는 코드라도 배포 전 DB 호환성·SQL과 Prisma schema 정합성·적용 순서를 확인한다. 해당 migration 실행은 별도 승인 범위이며 기존 PostgreSQL migration 절차를 유지한다. 검증용 격리 로컬 DB는 기존 테스트 방식대로 사용한다. 운영 DB를 검증 대상으로 사용하지 않는다.

## 모든 AUTO의 필수 Gate

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `node --test tests/deployment.test.mjs`
- `npm run build`
- `npm run test:ui` (전체 App/공개 화면/보안/Tenant Isolation 회귀; 격리 DB, Mock)
- Secret Scan 및 실제 diff 검토
- Workflow 변경 시 actionlint

하나라도 실패하면 BLOCKED, 배포 금지. 수정 후 영향받는 검증을 다시 실행한다. 테스트 삭제/무력화로 PASS를 만들지 않는다. CI에서도 전체 Browser/Tenant Isolation 테스트를 필수 실행한다.

## Secret 및 diff 검사

검토 대상은 작업 diff/새 파일, 최종 index, **origin/main 이후 전송될 모든 commit**이다. 중간 commit에서 추가 후 삭제한 Secret도 검사한다. 파일명으로 .env 실파일, credentials/secrets, key/certificate, DB dump/로컬 DB, node_modules, .next, 테스트 산출물이 포함되지 않게 한다. .env.example에도 실제 credential은 금지한다.

가능하면 redaction 지원 scanner를 사용한다. 최소한 scripts/deployment-secrets.mjs의 패턴/고엔트로피 검사와 수동 diff 검토를 수행한다. CI는 마지막 정상 배포부터 모든 도입 commit의 변경 파일을 검사한다. 출력에는 파일·줄·분류만 남기고 일치 값, password, token, DB URL을 출력하지 않는다. 참조/명백한 비작동 fixture와 실제 credential을 구분하되 미해결 후보는 BLOCKED다. 패턴 미탐지는 안전 보장이 아니다. 실제 Secret 노출을 approved SHA로 허용하거나 과거 이력을 임의 rewrite하지 않는다.

검증 후 `git diff --check`, `git diff --stat`, 안전하게 검토한 diff와 새 파일을 확인한다. Secret 의심 파일은 먼저 값이 출력되지 않는 검사를 수행한다.

## commit/push 절차

AUTO + 모든 Gate PASS이면 반복 승인 없이 수행한다. MANUAL_REVIEW는 그 변경에 대한 명시적 승인 후 수행한다.

1. main인지 확인. origin fetch 및 모든 push URL이 정확히 GitHub `dlsfhd3199-maker/intentbridge`인지 검사한다. HTTPS/SSH 허용, 다른 저장소/추가 목적지/credential URL 금지.
2. `git fetch origin` 및 `git rev-list --left-right --count origin/main...HEAD`로 원격 상태를 확인한다. 선행/분기/조회 실패면 중지한다. 임의 pull/rebase/merge 금지.
3. 기존 미전송 commit도 소유권·승인·Secret을 확인한다. 승인되지 않은 변경을 함께 push하지 않는다.
4. `git add -- <검토한 파일...>`로 해당 작업만 추가한다. `git add .` 금지. 기존 사용자 index를 임의로 비우거나 commit에 혼합하지 않는다.
5. `git diff --cached --check`, `--stat`, staged diff와 staged Secret 검사를 완료한다.
6. `ui:`, `feat:`, `fix:`, `refactor:`, `chore:`, `docs:` prefix로 commit하고 SHA/내용을 확인한다.
7. push 직전 branch/remote/outgoing commit과 새 사용자 변경을 다시 확인한 후 `git push origin main`.

모든 force push 옵션 금지. 실패하면 원인과 로컬 commit 보존 상태를 알린다. 승인 여부와 관계없이 강제 전송으로 해결하지 않는다.

## CI 승인 및 완료 보고

MANUAL_REVIEW commit Push 승인은 CI 수동 승인이나 DB 준비 완료를 대신하지 않는다. CI는 `workflow_dispatch`의 `reviewed_sha`가 대상 main 전체 40자 SHA와 일치할 때만 수동 검토를 통과시킨다. Codex가 임의 제출하거나 SHA를 자동 채워 우회하지 않는다. BLOCKED 또는 Quality 실패는 reviewed_sha로 해제하지 못한다.

Push 후 해당 SHA의 Cloudtype Staging 실행을 확인하고 Policy → Quality → Deploy and Health 실제 결과를 보고한다. Health 성공 전 배포 완료라고 하지 않는다. 조회 불가/진행 중/실패/skip은 그대로 기록한다. STAGING_BASELINE_SHA나 마지막 정상 태그를 성공 표시를 위해 수정하지 않는다. Health 뒤에만 마지막 정상 배포를 기록하는 기존 workflow를 유지한다.

완료 보고: Decision(AUTO/MANUAL_REVIEW/BLOCKED), 영향, Tests/Build 실제 결과, Commit 전체 SHA, Push, 해당 SHA의 Actions/Cloudtype 상태. 수동 검토면 'MANUAL_REVIEW 변경이므로 GitHub Push 전 검토가 필요합니다.'와 파일/영향/검증 결과를 보고한다. 사용자에게 필요한 reviewed_sha 전체 값을 제공한다. 실행/복구 상세는 AUTO_DEPLOYMENT.md를 따른다.
