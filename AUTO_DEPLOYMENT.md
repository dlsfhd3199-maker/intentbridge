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

## 실행과 안전장치

Codex 수정 → 로컬 검증 → 검토한 파일 commit/push → main의 Policy 및 Quality Gate → 공식 Cloudtype Action → 기존 Dockerfile 빌드/서비스 업데이트 → Health → 마지막 정상 배포 태그 기록.

- `.github/workflows/cloudtype-staging.yml`: main push + workflow_dispatch. 진행 중 배포 취소 없이 직렬화.
- Quality: npm ci → Prisma generate → TypeScript → Lint → 배포 테스트 → Unit → npm run build. 하나라도 실패하면 Deploy 실행 금지.
- LOW: UI/CSS/문구/차트/반응형. MEDIUM: 업무/캠페인/시뮬레이션 변경, 관련 테스트 필요.
- HIGH: Prisma, 인증, 권한, Tenant, 쓰기 API, Secret/배포/의존성 설정. 서버 lib/API는 보수적으로 HIGH. 경로 검사는 의미 분석을 대신하지 않으므로 개발자 검토도 필요.
- migration은 `DATABASE MIGRATION DETECTED`로 표시하고 자동 배포 차단. 자동 migrate/seed/reset 없음.
- 마지막 정상 `staging-deployed` 태그부터 전체 변경을 비교하고 태그가 없을 때 STAGING_BASELINE_SHA 사용. 막힌 migration 뒤 UI commit으로 우회 불가. 잘못된 baseline/비조상 이력도 차단.
- HIGH 변경은 push 전 검토, 배포는 main 전체 SHA를 `reviewed_sha`로 지정한 수동 실행 필요. 이번 Workflow 수정 자체도 HIGH이므로 다음 push 후 자동 배포 차단은 정상입니다.
- DB 변경은 백업/호환성 검토와 기존 AGENCY_ROLE_MIGRATION.md, AUTH_CREDENTIALS_MIGRATION.md의 수동 절차를 따릅니다. 실제 해당 버전의 migration을 수동 준비한 후 reviewed_sha로 승인합니다.
- 공식 Action에는 검증된 SHA를 전달합니다. Health는 해당 checkout에서 계산한 빌드 지문과 배포된 `/__deployment.json`을 비교하고 `/api/health` HTTP 200/status ok를 검사합니다. SHA 자체를 HTTP로 검증하는 것은 아니며 기존 지문 방식을 유지합니다. 앱/DB 상태 확인 범위를 과장하지 않습니다.
- Health 성공 뒤에만 staging-deployed 태그를 갱신합니다. 실패하면 기존 태그 유지, 자동 rollback 없음.
- `.github/workflows/browser-e2e.yml` 수동 E2E 유지. 기존 로컬 실행 약 3분.

## Codex 작업과 수동 복구

Codex의 작업 시작, Risk 분류, Secret 검사, 사용자 변경 보호, 검증, commit/push 및 완료 보고 규칙은 루트 [AGENTS.md](AGENTS.md)를 단일 기준으로 사용합니다. LOW/MEDIUM은 해당 조건 충족 시 반복 승인 없이 commit/push하며 HIGH는 사용자 명시적 승인 전 push하지 않습니다. 기존 Actions의 보수적인 경로 판정도 유지합니다. 배포 설정/복구 절차는 이 문서를 따릅니다.

설정 후 같은 main SHA로 Actions Run workflow를 실행하고 reviewed_sha에 해당 SHA를 지정합니다. Secret 누락이면 Cloudtype main의 Secret 이름과 기존 값 일치를 확인합니다. 품질 실패는 코드를 수정하며 검사 생략으로 우회하지 않습니다. Health 실패는 Cloudtype 빌드/실행 로그·공개 지문·포트/주소를 확인합니다.

Actions 장애 때는 동일 commit 로컬 Gate 및 위험 검토를 통과한 후 기존 서비스의 Cloudtype 화면에서 Dockerfile로 수동 배포하고 Health를 확인합니다. 이후 동일 버전의 workflow를 성공시켜 태그를 동기화합니다. 수동 rollback 시 실제 코드/DB 상태를 먼저 확인하고 기준 태그를 정합하게 유지합니다.

Private 저장소는 기존 SSH Deploy Key와 Actions 권한으로 배포합니다. visibility 전환 후 수동 배포로 clone을 검증합니다. contents: write는 마지막 정상 태그 기록에만 사용합니다.

## 확인한 공식 근거

- [고정된 공식 Action 소스](https://github.com/cloudtype-github-actions/deploy/blob/43cf563907c5451c12ecc4461bdbf02e61528d1d/src/action.ts): endpoint 기본값, 단일 서비스 설정 전달, 배포 요청 뒤 종료.
- [Cloudtype 환경변수](https://docs.cloudtype.dev/ko/developers/env): 배포환경별 Secret 및 YAML의 secret 속성.
- [Cloudtype GitHub Actions](https://docs.cloudtype.dev/ko/developers/githubactions): 서비스 설정 전달 및 리소스 미지정 시 대시보드 쿼터 유지.

사용자가 GitHub → Cloudtype Staging 실제 배포 성공을 확인했습니다. 향후 각 변경의 배포 상태는 해당 SHA의 Actions 결과로 별도 확인합니다. Git 운영 지침 최초 작성 작업에서는 사용자 요청에 따라 commit/push 및 실제 배포를 수행하지 않습니다.
