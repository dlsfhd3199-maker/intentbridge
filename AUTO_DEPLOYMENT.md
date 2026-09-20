# IntentBridge Staging 자동 배포

## 현재 대상과 최초 오류

기존 `progressmedia/intentbridge` 프로젝트 → Cloudtype 배포환경 `main` → 서비스 `intentbridge`만 대상으로 합니다. GitHub Environment 이름은 기존 `staging`입니다. PostgreSQL 서비스, DB schema/data, Product UI 2.0, 인증/권한은 변경하지 않습니다.

기존 준비 스크립트는 공식 Action의 선택 입력인 endpoint를 필수로 검사하고 전체 서비스 JSON을 요구했습니다. endpoint가 없으면 `new URL(undefined)` 단계에서 실패했고 JSON도 없으면 이어서 파싱 실패가 발생했습니다. 지금은 둘 다 요구하지 않습니다. 오류에는 고정된 변수 이름/검증 설명만 출력합니다.

## 필요한 GitHub 설정

Settings → Secrets and variables → Actions:

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Secret | CLOUDTYPE_TOKEN | 기존 Cloudtype API key 유지 |
| Variable | CLOUDTYPE_PROJECT | `progressmedia/intentbridge` |
| Variable | CLOUDTYPE_STAGE | `main` |
| Variable | STAGING_URL | `https://port-0-intentbridge-mu58gkdf5dac107d.sel3.cloudtype.app` |
| Variable | STAGING_BASELINE_SHA | 최초 기준으로 확인한 실제 배포 commit의 전체 SHA. 기존 값 유지 |

`CLOUDTYPE_ENDPOINT`, `CLOUDTYPE_SERVICE_JSON`은 제거해도 됩니다. GHP_TOKEN도 필요하지 않습니다. 이미 등록한 읽기 전용 Deploy Key를 사용하므로 connect Action을 반복 실행하지 않습니다. 자동 제공되는 GITHUB_SHA/GITHUB_REPOSITORY는 직접 등록하지 않습니다.

공식 deploy Action을 기존 고정 commit으로 사용하며 endpoint 입력을 생략합니다. 해당 소스의 기본값은 `https://api.cloudtype.io`입니다. 별도 API나 endpoint를 만들지 않습니다.

## Cloudtype에서 첫 배포 전에 할 일

**서비스 환경변수와 배포환경 Secret 저장소는 별개입니다.** 현재 서비스에 직접 입력된 값이 있다고 해서 동명의 Secret 참조가 자동으로 생성되는 것은 아닙니다.

Cloudtype `progressmedia/intentbridge`의 **main 배포환경 Secret**에 아래 이름을 준비합니다. 이미 해당 이름으로 존재하면 그대로 사용합니다. 없다면 기존 서비스의 값을 Cloudtype 안에서 그대로 저장합니다. Secret 값을 재발급하거나 GitHub/코드/로그로 복사하지 않습니다.

| 서비스 환경변수 | main 배포환경 Secret 이름 |
| --- | --- |
| DATABASE_URL | DATABASE_URL |
| AUTH_SECRET | AUTH_SECRET |
| AUTH_URL | AUTH_URL |
| RESEND_API_KEY | RESEND_API_KEY |
| AUTH_EMAIL_FROM | AUTH_EMAIL_FROM |
| INITIAL_ADMIN_EMAIL | INITIAL_ADMIN_EMAIL |
| INITIAL_ADMIN_PASSWORD | INITIAL_ADMIN_PASSWORD |

특히 DATABASE_URL은 현재 PostgreSQL 연결값, AUTH_SECRET은 기존 값을 유지합니다. AUTH_URL도 기존 인증 HTTPS 주소를 유지합니다. 관리자 초기화 변수는 참조만 하며 관리자 생성/seed 명령은 실행하지 않습니다.

이전에 `IB_STAGING_*` 이름으로 만들었다면 동명 Secret을 위 표에 맞춰 같은 값으로 준비합니다. Secret 이름을 환경변수의 일반 `value`로 전달하라는 이전 안내는 잘못되었습니다. 공식 환경변수 문서의 **`secret` 속성**을 사용합니다:

```yaml
- name: DATABASE_URL
  secret: DATABASE_URL
```

준비 스크립트는 다음 공개 설정과 위 7개 Secret 참조를 포함한 작은 JSON 템플릿을 자동 생성합니다. 사용자가 JSON을 관리하지 않습니다.

```yaml
name: intentbridge
app: dockerfile
options:
  ports: "3000"
  dockerfile: Dockerfile
  healthz: /api/health
  # env는 scripts/deployment-config.mjs에서 생성
context:
  git:
    url: git@github.com:dlsfhd3199-maker/intentbridge.git
    # ref는 검증한 GITHUB_SHA로 지정
```

공개 환경변수는 APP_ENV=staging, NODE_ENV=production, PORT=3000, GA4_DATA_MODE=mock, RATE_LIMIT_STORE=database입니다. 사용자가 제공한 환경변수 12개를 명시적으로 유지합니다. **이 목록 이외의 기존 서비스 환경변수/커스텀 옵션이 실제로 있다면 첫 배포 전에 템플릿에 추가해야 합니다.** 생략한 환경변수가 자동으로 병합·보존된다고 가정하지 않습니다. Secret 참조의 실제 존재 여부는 로컬에서 확인하지 못하며 사용자가 위 설정을 완료해야 합니다.

리소스 쿼터는 명시하지 않아 공식 문서에 따라 대시보드 설정을 사용합니다. 별도 start command 없이 기존 Dockerfile CMD를 사용합니다. PostgreSQL 서비스 설정을 payload에 넣지 않고, 프로젝트/배포환경을 코드에서 정확히 제한합니다. 대상 서비스가 삭제/이름 변경된 상태에서는 실행하지 마세요. 공식 deploy Action은 기존 서비스 존재를 미리 확인하는 기능이 없으므로 서비스 부재 시 생성하지 않는다는 서버 측 보장까지 추가한 것은 아닙니다.

기존 Cloudtype 자체 push 자동 배포/webhook은 해제하여 품질 검사를 우회하지 않도록 합니다. 기존 SSH Deploy Key, GitHub staging Environment와 main 배포 제한을 유지합니다.

## DEVELOPMENT / STAGING PHASE 정책

실제 광고주 운영 데이터/GA4·매체 실측 저장 및 실제 Campaign Write 도입 전에 Production 정책으로 재검토합니다. PostgreSQL의 계정·승인·Membership·Workspace 데이터는 계속 보호합니다.

| 결정 | 의미 |
| --- | --- |
| AUTO | 일반 제품 개발. 로컬 Gate·Secret/diff 검토 후 자동 commit/push, CI 필수 Gate 통과 후 Staging 자동배포 |
| MANUAL_REVIEW | 아래 5개 범주. 로컬 commit/push는 해당 변경 승인 후 수행. 배포는 main 전체 SHA를 reviewed_sha로 수동 지정 |
| BLOCKED | Secret/필수 검증 실패/잘못된 저장소·이력 등. 승인으로 우회할 수 없음 |

AUTO: UI, Public Website/Public Route, 일반 페이지, Dashboard/Journey/Performance/Campaign/Operations/Reports/Connections, Demo Connector/Dataset, Notification/Search/Onboarding, 일반 업무 로직, 비파괴 조회 및 기존 Tenant 경계를 유지하는 Create/Update API, 플랫폼 설정 저장, Export/Report. lib/** 또는 app/api/** 경로만으로 수동 승인을 요구하지 않습니다.

MANUAL_REVIEW는 ① 파괴적 DB·분석 불가 migration ② 핵심 인증·Session·Password·Guard ③ Role/Permission/Membership/Tenant 접근 제어 ④ Secret/환경 구조 ⑤ CI/CD·Docker·Cloudtype·배포/빌드/테스트 실행 및 Git 정책 변경입니다. 관련 보안 테스트 약화도 CI 보안 변경으로 검토합니다. LOW/MEDIUM은 AUTO의 참고 정보입니다.

Public 페이지 추가는 AUTO지만 proxy/중앙 권한 경계 수정은 수동 검토합니다. 기존 requireAdvertiserAccess 등의 Guard를 유지한 일반 API 저장 로직은 AUTO입니다. Guard 인자나 광고주 범위를 제거/변경하면 수동 검토합니다. 이름·호출 signature 기반 정적 검사는 임의 코드의 안전성을 증명하지 못합니다. **실제 diff와 신규 API의 IDOR/Tenant 테스트를 개발자가 반드시 검토**합니다. 새 인증/권한 구현을 다른 파일명으로 옮겨 AUTO로 만드는 것은 금지합니다.

### 필수 CI Gate

Policy(전체 이력 Secret Scan + SQL 분석 + 민감 변경 판정)와 Quality를 모두 통과해야 Deploy합니다.

Quality: npm ci → Prisma generate → TypeScript → Lint → deployment tests → Unit → Build → Chromium 설치 → 전체 Browser/Tenant Isolation 회귀. 브라우저 검증은 Mock과 격리된 로컬 SQLite DB이며 실제 Cloudtype DB/API를 사용하지 않습니다. 테스트/Build 실패는 BLOCKED로 요약하고 reviewed_sha가 있어도 Deploy를 실행하지 않습니다. 기존 별도 수동 E2E workflow도 유지합니다.

Secret scan은 마지막 정상 배포 이후 도입된 각 commit(merge parent 포함)의 변경 파일을 검사합니다. 중간 commit에 추가 후 삭제된 Secret도 BLOCKED입니다. key header, 공급자 token, DB credential URL, credential literal, 고엔트로피 후보와 민감 파일명을 검사하며 값은 로그에 출력하지 않습니다. 탐지 후보는 원인을 해결해야 하며 reviewed_sha 예외가 없습니다. 패턴 검사에는 미탐/오탐 가능성이 있으므로 값이 없는 안전한 검토를 병행하고 실제 Secret은 절대 허용하지 않습니다.

### Migration 판정과 실행은 별개

새 migration SQL만 제한된 SQL allowlist로 분석합니다. 새 table(지원 scalar type/PK), nullable column 추가, 일반 index 추가는 NON_DESTRUCTIVE로 AUTO 가능합니다. NOT NULL/unique index/지원 밖 SQL은 수동 검토, DROP COLUMN/TABLE·TRUNCATE·전체 DELETE·인식 가능한 rename/UPDATE는 파괴적 변경으로 수동 검토합니다. 분석 실패 구문과 destructive operation이 함께 있으면 BLOCKED입니다. 기존 migration 편집/삭제, schema만 변경, 기존 field 제거/변경은 자동 승인하지 않습니다. Auth/Membership 모델은 additive라도 수동 검토합니다.

SQL 분석은 전체 PostgreSQL 문법/DB 상태 검증이 아닙니다. SQL과 Prisma schema 정합성, 중복 index, 실제 데이터 제약, 실행 계획/lock, 애플리케이션과 DB 버전 호환성은 별도 검토 대상입니다. **AUTO는 migration 자동 실행을 뜻하지 않습니다.** 기존 production migration 전략을 유지하여 이 pipeline에서는 Staging migrate/seed/reset을 실행하지 않습니다. 새 column/table을 사용하는 코드는 배포 전 기존 PostgreSQL 절차로 DB 준비가 필요합니다. SQL 적용은 별도의 승인 범위입니다.

### 배포·복구 안전장치

- 마지막 정상 staging-deployed 태그부터 누적 변경을 비교하며 태그가 없으면 STAGING_BASELINE_SHA를 사용합니다. 후속 UI commit으로 민감 변경을 숨길 수 없습니다.
- 잘못된 baseline, 비조상 이력/force push 필요 상황, 예상 origin/GITHUB_REPOSITORY 불일치는 BLOCKED입니다.
- reviewed_sha는 workflow_dispatch에서 대상 전체 SHA와 일치할 때만 MANUAL_REVIEW를 통과시킵니다. 자동 생성/임의 제출 금지. 로컬 Push 승인과 CI 수동 실행은 별개입니다.
- main push + workflow_dispatch, 직렬 실행, 기존 공식 Cloudtype Action과 서비스만 유지합니다. 이번 정책 수정도 MANUAL_REVIEW이므로 최초 적용에는 사용자 검토가 필요합니다.
- Health는 동일 checkout의 빌드 지문과 /__deployment.json 일치 및 /api/health HTTP 200/status ok를 확인합니다. SHA 자체를 HTTP로 검증하는 것은 아닙니다.
- Health 성공 뒤에만 마지막 정상 태그를 갱신합니다. 실패 시 기존 태그를 유지하고 자동 rollback하지 않습니다.

## Codex 작업과 수동 복구

Codex의 작업 시작, Risk 분류, Secret 검사, 사용자 변경 보호, 검증, commit/push 및 완료 보고 규칙은 루트 [AGENTS.md](AGENTS.md)를 단일 기준으로 사용합니다. AUTO는 필수 Gate 통과 후 반복 승인 없이 commit/push하며 MANUAL_REVIEW는 사용자 명시적 승인 전 commit/push하지 않습니다. BLOCKED는 원인을 해결하고 재검증해야 합니다. 배포 설정/복구 절차는 이 문서를 따릅니다.

설정 후 같은 main SHA로 Actions Run workflow를 실행하고 reviewed_sha에 해당 SHA를 지정합니다. Secret 누락이면 Cloudtype main의 Secret 이름과 기존 값 일치를 확인합니다. 품질 실패는 코드를 수정하며 검사 생략으로 우회하지 않습니다. Health 실패는 Cloudtype 빌드/실행 로그·공개 지문·포트/주소를 확인합니다.

Actions 장애 때는 동일 commit 로컬 Gate 및 위험 검토를 통과한 후 기존 서비스의 Cloudtype 화면에서 Dockerfile로 수동 배포하고 Health를 확인합니다. 이후 동일 버전의 workflow를 성공시켜 태그를 동기화합니다. 수동 rollback 시 실제 코드/DB 상태를 먼저 확인하고 기준 태그를 정합하게 유지합니다.

Private 저장소는 기존 SSH Deploy Key와 Actions 권한으로 배포합니다. visibility 전환 후 수동 배포로 clone을 검증합니다. contents: write는 마지막 정상 태그 기록에만 사용합니다.

## 확인한 공식 근거

- [고정된 공식 Action 소스](https://github.com/cloudtype-github-actions/deploy/blob/43cf563907c5451c12ecc4461bdbf02e61528d1d/src/action.ts): endpoint 기본값, 단일 서비스 설정 전달, 배포 요청 뒤 종료.
- [Cloudtype 환경변수](https://docs.cloudtype.dev/ko/developers/env): 배포환경별 Secret 및 YAML의 secret 속성.
- [Cloudtype GitHub Actions](https://docs.cloudtype.dev/ko/developers/githubactions): 서비스 설정 전달 및 리소스 미지정 시 대시보드 쿼터 유지.

사용자가 GitHub → Cloudtype Staging 실제 배포 성공을 확인했습니다. 향후 각 변경의 배포 상태는 해당 SHA의 Actions 결과로 별도 확인합니다. Git 운영 지침 최초 작성 작업에서는 사용자 요청에 따라 commit/push 및 실제 배포를 수행하지 않습니다.
