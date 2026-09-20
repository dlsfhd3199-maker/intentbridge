# IntentBridge Staging 자동 배포

Product UI 2.0과 [PRODUCT_UI_2.md](PRODUCT_UI_2.md)를 기준으로 유지합니다. 앱 기능, 인증, 권한, Tenant Isolation, DB schema는 이 작업에서 바꾸지 않습니다. Production 배포는 구성하지 않습니다.

## 배포 흐름

Codex 수정 → 로컬 검증 → 검토한 파일 commit → main push → GitHub Actions Quality Gate/Build + 변경 위험 검사 → 공식 Cloudtype deploy Action → 기존 Dockerfile로 Cloudtype 빌드/실행 → 새 빌드 지문 + `/api/health` HTTP 200 확인 → `staging-deployed` 태그 갱신.

- `.github/workflows/cloudtype-staging.yml`: main push 및 수동 실행. 모든 push에 품질 검사를 실행하고 문서만 변경되면 배포를 생략합니다.
- `.github/workflows/browser-e2e.yml`: 수동 브라우저 회귀. 기존 로컬 전체 실행은 약 3분이므로 기본 배포 Gate와 분리합니다. Linux는 Playwright Chromium, Windows는 기존 Edge를 사용합니다.
- Quality Gate: `npm ci` → `npm run db:generate` → TypeScript → Lint → 배포 안전성 테스트 → 기존 Unit Test → `npm run build`. 실패하면 Deploy는 실행되지 않습니다. Actions step에서 각각 상태를 확인합니다.
- Cloudtype는 검사한 **commit SHA**를 SSH로 가져옵니다. 움직이는 main의 최신 코드를 별도로 배포하지 않습니다.
- 동시 배포는 직렬화하며 진행 중 배포를 취소하지 않습니다. 대기 중인 오래된 실행은 GitHub 동시성 정책에 따라 생략될 수 있습니다.
- Dockerfile은 기존 Node 22/Prisma PostgreSQL generate/Next build/CMD를 유지합니다. 추가되는 것은 공개 가능한 코드 지문 파일 `public/__deployment.json` 생성뿐이며 DB/Secret/이메일은 포함하지 않습니다. 파일은 Git에 저장하지 않습니다.
- 공식 deploy Action은 요청 접수 뒤 종료하므로, Health 단계가 최대 약 23분(90회, 요청 타임아웃 포함) 동안 배포될 빌드 지문을 기다립니다. 이전 코드의 HTTP 200만으로 성공 처리하지 않습니다. `/api/health` 자체는 기존처럼 프로세스 상태만 확인하며 DB 접속 검사는 아닙니다. 지문은 런타임 소스/빌드 입력 기준이고 commit ID나 Cloudtype 설정 변경의 증명은 아닙니다.

## 최초 1회 설정

### 1. Cloudtype 기존 Staging 서비스 확인

1. `intentbridge` 프로젝트의 기존 `intentbridge` 서비스와 실제 배포환경 이름을 확인합니다. 앱이 Staging이어도 Cloudtype 환경 이름이 `main`일 수 있으므로 이름을 추측하지 않습니다.
2. **기존 Cloudtype Git push 자동 배포/webhook은 해제**합니다. 이 워크플로우만 배포를 요청해야 Quality Gate를 우회하지 않습니다.
3. 기존 Dockerfile, 루트 build context, PORT 3000, `/api/health`, 기본 Docker CMD, PostgreSQL 연결을 유지합니다. 시작/빌드 명령에 migrate/seed를 넣지 않습니다.
4. 기존 런타임 Secret을 Cloudtype **프로젝트 Secret**으로 보관하고 서비스에서 참조합니다. 아래 참조 이름을 사용합니다. 값은 Cloudtype에만 입력합니다.

| 런타임 변수 | Cloudtype 프로젝트 Secret 이름 |
| --- | --- |
| DATABASE_URL | IB_STAGING_DATABASE_URL |
| AUTH_SECRET | IB_STAGING_AUTH_SECRET |
| RESEND_API_KEY (사용 중인 경우) | IB_STAGING_RESEND_API_KEY |
| 그 외 TOKEN/PASSWORD/API_KEY | IB_STAGING_로 시작하는 별도 이름 |

기존 Secret **값을 교체하거나 재발급할 필요는 없습니다.** 특히 AUTH_SECRET은 유지합니다. 현재 Credentials 인증의 Resend 사용 여부도 변경하지 않습니다. `AUTH_URL`은 기존 HTTPS 주소, `APP_ENV=staging`, `GA4_DATA_MODE=mock`, 나머지 기존 보안/DB 환경변수와 리소스 설정을 유지합니다.

5. 서비스 CLI → GitHub Actions에서 **현재 서비스의 배포 설정 부분**을 확인합니다. `name: intentbridge`, `app: dockerfile`, `options`, `context`, 필요한 리소스 설정을 JSON으로 변환하여 아래 `CLOUDTYPE_SERVICE_JSON` 변수에 넣습니다. 전체 workflow를 넣는 것이 아닙니다. `options.env`는 기존 변수 전체를 포함하고, Secret의 value는 실제 값이 아닌 위 **프로젝트 Secret 이름 참조**여야 합니다. 공식 문서는 프로젝트 Secret 이름을 value로 참조하도록 안내합니다. API endpoint는 이 화면의 생성된 workflow 값을 그대로 사용합니다.

**생성된 설정에 실제 Secret 값이 보이면 복사하지 마세요.** 먼저 Cloudtype Secret 참조로 전환하고 재확인합니다. 임의로 env를 생략하면 기존 환경을 덮어쓸 위험이 있어 본 워크플로우는 완전한 서비스 설정을 요구합니다. 서비스 환경/리소스를 바꿀 때 이 변수의 비밀값 없는 설정도 함께 갱신합니다. `context.git`만 워크플로우가 저장소 SSH URL과 검증된 SHA로 고정합니다.

### 2. Private 저장소 접근 준비

Cloudtype의 기존 저장소 연결 화면에서 해당 스페이스의 SSH 배포 공개키를 확인하고 GitHub `dlsfhd3199-maker/intentbridge` → Settings → Deploy keys에 **읽기 전용**으로 등록합니다(Allow write access 끔). Cloudtype 소스는 `git@github.com:dlsfhd3199-maker/intentbridge.git`입니다. GitHub App 연결만으로 된 것으로 추측하지 말고 SSH 키의 해당 저장소 접근을 확인하세요.

이 방식은 공식 connect Action이 자동 생성하는 Deploy Key를 최초 1회 직접 등록하는 방식입니다. 매 배포마다 GitHub 관리자 PAT를 사용할 필요가 없으므로 **GHP_TOKEN은 필요하지 않습니다.** GitHub Actions checkout은 기본 GITHUB_TOKEN을 사용합니다.

### 3. GitHub Actions 설정

Settings → Secrets and variables → Actions:

| 종류 | 이름 | 값/용도 |
| --- | --- | --- |
| Secret | CLOUDTYPE_TOKEN | 해당 Staging 프로젝트에 배포할 수 있는 Cloudtype API key |
| Variable | CLOUDTYPE_PROJECT | `스페이스명/intentbridge` (실제 스페이스명) |
| Variable | CLOUDTYPE_STAGE | 실제 Staging 배포환경 이름. Production 이름 사용 금지 |
| Variable | CLOUDTYPE_ENDPOINT | Cloudtype 서비스가 생성한 workflow의 HTTPS API endpoint |
| Variable | CLOUDTYPE_SERVICE_JSON | 위의 비밀값 없는 기존 Dockerfile 서비스 설정 JSON |
| Variable | STAGING_URL | 기존 Staging HTTPS origin, 경로/query 없이 |
| Variable | STAGING_BASELINE_SHA | 최초 설정 시 **현재 실제 배포된** 코드의 전체 40자 commit SHA |

DB 비밀번호, DATABASE_URL 실값, AUTH_SECRET 실값, Resend 키는 GitHub에 등록하지 않습니다. `CLOUDTYPE_SERVICE_JSON`의 민감 변수에는 `IB_STAGING_*` 참조 이름만 허용합니다.

Settings → Environments에 `staging`을 만들고 배포 가능 브랜치를 main으로 제한합니다. 필수 검토자를 설정하면 LOW 변경도 매번 승인이 필요하므로 팀 정책에 따라 선택합니다. HIGH 변경은 워크플로우가 별도로 차단하며, **main에 쓸 수 있는 신뢰한 사용자만 수동 검토 SHA를 제출**해야 합니다. 저장소 Rulesets/branch protection으로 main 직접 변경과 배포 스크립트 변경을 검토하도록 권장합니다. 자체 워크플로우 검사는 main 쓰기 권한자의 악의적 변경까지 막는 보안 경계는 아닙니다.

Actions 사용을 허용하고 deploy job의 `contents: write`와 `staging-deployed` 태그 갱신을 허용합니다. 해당 태그는 배포 이력 포인터이며 사용자가 임의로 옮기지 않습니다. 배포 토큰은 repo Secret 또는 `staging` Environment Secret에 저장할 수 있습니다.

### 4. 최초 실행과 Private 전환

1. 현재 실제 배포 SHA를 확인하여 baseline을 등록합니다. DB가 이 SHA의 PostgreSQL migrations까지 준비되어 있는지 확인합니다. 확인되지 않은 최신 SHA를 baseline으로 입력하지 않습니다.
2. UI 2.0 변경과 파이프라인 파일을 검토·검증한 뒤 commit/push합니다. 최초 pipeline/Dockerfile 변경은 HIGH로 표시되어 자동 배포가 차단되는 것이 정상입니다.
3. Actions → Cloudtype Staging → Run workflow → main → `reviewed_sha`에 검토 완료한 main의 전체 SHA를 입력합니다. 검토 대상 SHA와 실행 SHA가 다르면 우회되지 않습니다.
4. Quality/Build, Deploy, Health 성공 및 Cloudtype에서 배포 SHA/로그를 확인합니다.
5. Settings → General → Danger Zone → Change visibility → Private로 전환합니다. 읽기 전용 Deploy Key와 Actions가 유지되는지 확인하고 수동 실행을 한 번 더 검증합니다. 저장소의 공개 상태를 이 작업에서 임의로 변경하지 않습니다.

Cloudtype 값/Secret을 이 작업 환경에 제공하지 않아도 됩니다. 위 화면에서 사용자가 직접 설정합니다. GitHub에는 기존 Actions Secret/Variable 이름이 없는 상태임을 확인했으며, 설정 없는 실제 배포 성공을 주장하지 않습니다.

## 변경 위험과 DB 보호

| 위험 | 예 | 작업 기준 |
| --- | --- | --- |
| LOW | UI, CSS, 문구, 차트, 반응형 | 로컬 검증 후 승인된 범위의 commit/push, Gate 통과 시 자동 Staging |
| MEDIUM | 비즈니스/시뮬레이션/캠페인/읽기 API | 관련 테스트와 Gate 통과 후 배포 |
| HIGH | Prisma, 인증, 권한, Tenant, 쓰기 API, Secret, 배포/의존성 설정 | push 전 별도 코드 검토, 배포는 수동 reviewed_sha |

경로 기반 검사는 의미 분석이 아니므로 서버 lib/API는 보수적으로 HIGH 처리합니다(읽기 API도 포함). UI 파일 안에서 보안/쓰기 로직을 바꾸는 경우 개발자가 직접 HIGH로 분류하고 push 전에 검토합니다.

Prisma 폴더 변경(추가/수정/삭제/이동, SQLite와 PostgreSQL 양쪽)을 발견하면 **DATABASE MIGRATION DETECTED — Staging Migration Required**를 Summary에 표시하고 자동 배포를 실패 처리합니다. 비교 대상은 직전 push가 아니라 `staging-deployed`(없으면 최초 baseline)입니다. 이후 UI 커밋을 올려도 미배포 migration은 계속 감지됩니다. baseline 없음/비조상/force push도 차단합니다.

DB 변경 시: 백업 → migration SQL/호환성 검토 → 기존 [AGENCY_ROLE_MIGRATION.md](AGENCY_ROLE_MIGRATION.md), [AUTH_CREDENTIALS_MIGRATION.md](AUTH_CREDENTIALS_MIGRATION.md)의 중지/이전 절차 준수 → 해당 버전의 명시적 릴리스 환경에서 `npm run db:migrate:pg`를 **수동** 실행 → 필요한 점검 → 검토한 SHA로 수동 workflow. 새 migrations가 아직 없는 구버전 컨테이너에서 migrate를 실행해 완료로 간주하지 않습니다. 새 image를 별도로 빌드/준비해 release console을 사용합니다. 자동 seed/reset/db push/destructive migration은 없습니다.

검토 입력은 **검토/DB 준비가 끝났다는 작업자의 확인**이며 DB 상태를 자동 검증하는 기능은 아닙니다. HIGH를 승인한 뒤 코드가 달라지면 새로운 SHA에 대한 검토가 필요합니다. Health 실패 시 태그는 갱신되지 않고 자동 rollback도 하지 않습니다.

## Codex 작업 완료 기준

1. `git status --short`, `git diff`로 기존 작업 및 변경 범위를 확인합니다. Product UI 2.0 파일을 되돌리거나 누락하지 않습니다.
2. 위험 분류 및 관련 테스트 → `npm run typecheck` → `npm run lint` → `node --test tests/deployment.test.mjs` → `npm test` → `npm run build`. UI/권한 경로 변경은 필요 시 `npm run test:ui`도 실행합니다.
3. 검토한 파일만 `git add <파일...>`로 stage합니다. `.env`, Secret, 로컬 DB, 테스트 산출물 제외. `git diff --cached --check`, `git diff --cached` 확인.
4. `git commit -m "ui: improve advertiser dashboard"`와 `git push origin main`. HIGH는 push 전에 별도 검토합니다. 이 지침은 무관한 사용자 작업을 자동으로 commit하는 권한이 아닙니다.
5. Actions가 Gate/Build/Deploy/Health를 처리합니다. Codex가 GitHub 사용 권한이 있으면 `gh run list --workflow cloudtype-staging.yml`, `gh run view <run-id>`로 결과까지 확인합니다. 로컬 완료와 실제 배포 완료를 구분해 보고합니다.

Commit prefix: `feat:`, `fix:`, `ui:`, `refactor:`, `chore:`. 정상적인 LOW/MEDIUM 개발에서는 최초 설정 후 사용자가 반복해서 CMD 명령을 실행할 필요가 없습니다.

## 수동 복구

- 품질 실패: 실패한 검사 수정 → 새 commit/push. 실패를 무시하는 플래그는 없습니다.
- Cloudtype 설정/키 실패: Secret/변수/Deploy Key 만료·대상 확인 → 같은 main으로 Run workflow. 실제 Secret을 로그/이슈에 붙이지 않습니다.
- Health 실패: Cloudtype 빌드 및 실행 로그, 새 지문 응답, 포트/주소 확인. `/api/health`만 성공해도 새 지문이 다르면 실패 상태를 유지합니다.
- Actions 장애: 동일 commit 로컬 Gate 통과 → 위험/DB 검토 → Cloudtype 기존 서비스에서 해당 SHA를 Dockerfile로 수동 배포 → `/__deployment.json` 및 `/api/health` 확인. 이후 동일 SHA의 workflow를 성공시켜 태그를 동기화합니다. DB rollback은 앱 rollback과 별도로 검토합니다.
- `staging-deployed`가 실제 수동 rollback 상태와 달라졌다면 자동 배포를 중지하고 실제 배포 commit/DB 상태를 확인한 뒤 포인터를 수정합니다. 위험 검사만 통과시키려고 baseline을 최신으로 옮기지 않습니다.

## 공식 근거와 검증 범위

- [Cloudtype GitHub Actions](https://docs.cloudtype.dev/ko/developers/githubactions): 배포 설정 전달/프로젝트/배포환경/Secret 참조.
- [공식 deploy Action 소스](https://github.com/cloudtype-github-actions/deploy/blob/43cf563907c5451c12ecc4461bdbf02e61528d1d/src/action.ts): 고정 SHA 사용, API 요청 뒤 종료하므로 별도 Health 필요.
- [비공개 저장소 SSH 배포](https://docs.cloudtype.dev/ko/developers/private-repo), [Dockerfile 배포](https://docs.cloudtype.dev/ko/developers/dockerfile).

로컬 테스트는 YAML 파싱/Gate 의존관계/main·manual 트리거/마이그레이션 누적 감지/잘못된 baseline/지문/HTTP 및 네트워크 실패를 검증합니다. 실제 GitHub runner와 Cloudtype 토큰/Private clone/배포 성공은 최초 설정 후 확인해야 합니다. 로컬 Docker Desktop engine이 실행되지 않아 Docker build는 실행하지 못했습니다.

이번 검증 결과: 임시 폴더의 clean `npm ci` 성공, TypeScript/Lint 성공, 기존 Unit 64/64와 배포 안전성 7/7 통과, actionlint 통과, `npm run build` 성공. 로컬 production 빌드를 `APP_ENV=development`로 별도 포트에서 실행해 `/api/health` HTTP 200/status ok와 공개 지문 응답 일치를 확인했습니다. Staging Secret이 필요한 실제 Staging 시작/DB 접속 테스트로 간주하지 않습니다. 브라우저 전체 테스트는 이번 파이프라인 작업에서 재실행하지 않았습니다. 기존 UI 2.0 검증 기록은 PRODUCT_UI_2.md에 유지합니다.
