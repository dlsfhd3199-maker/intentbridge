# IntentBridge 개발 완료 및 Git 반영 규칙

이 파일은 이 저장소에서 수행하는 Codex 작업에 적용한다. 사용자가 해당 작업에서 지정한 제한(예: commit/push 금지)을 우선한다. 별도 배포 시스템이나 예약 작업을 만들지 않고 기존 GitHub Actions → Cloudtype Staging Pipeline을 사용한다. 배포 설정과 복구 절차는 AUTO_DEPLOYMENT.md를 따른다.

## 작업 시작

다음 명령으로 초기 상태를 기록한다.

```sh
git status --short
git branch --show-current
git rev-parse HEAD
```

기존 staged/unstaged/untracked 파일과 작업 전 HEAD를 구분한다. 기존 변경을 덮어쓰거나 자신의 변경으로 간주하지 않는다. 사용자 작업과 같은 파일을 수정해야 하면 기존 diff를 먼저 확인하고 보존한다. 출처가 섞여 분리 검토할 수 없다면 자동 commit/push를 보류한다.

사용자 명시적 요청 없이 `git reset --hard`, `git clean -fd`, `git checkout -- .`, `git restore .` 및 동등한 대량 삭제/복원 명령을 사용하지 않는다. 기존 index도 임의로 비우거나 다시 stage하지 않는다.

## Risk Classification

파일명뿐 아니라 실제 diff의 의미와 영향으로 분류한다. 여러 등급이 섞이면 가장 높은 등급을 적용하며, HIGH를 작은 commit으로 분리해서 승인 없이 우회하지 않는다.

| 등급 | 대상 | 완료 후 동작 |
| --- | --- | --- |
| LOW | UI/CSS/Typography/Responsive/Copy/Layout, Chart Presentation, Empty State, Icon, client presentation | 기본 검증 및 diff/Secret 검사 성공 후 별도 확인 없이 해당 작업 commit + push |
| MEDIUM | 기존 business/read API logic, Simulation/Campaign 계산, data transformation, 일반 component logic | 관련 테스트 + 기본 검증 + diff/Secret 검사 성공 후 해당 작업 commit + push |
| HIGH | DB/Prisma/migration, Auth.js/Credentials/password/session, Authorization/role/permission, SUPER_ADMIN/MANAGER/ADVERTISER 권한, membership/tenant isolation/admin approval, API write, Secret/env, security, destructive data operations, Dockerfile/.dockerignore, .github/workflows/**, scripts/deployment-*, Cloudtype 설정, 의존성/런타임 설정, AGENTS.md/Git 운영 규칙, AUTO_DEPLOYMENT.md 실행 설정 | 구현·검증·위험 보고까지. 자동 push 금지, 기본적으로 commit도 보류 |

Dashboard/Journey/Performance/Campaign/Operations/Reports의 표현만 바꾸고 Backend/API/Auth/DB에 영향을 주지 않는 변경은 LOW로 판단할 수 있다. UI 파일에 있는 권한 검사/쓰기 동작/민감 데이터 처리 변경은 HIGH다. 판단이 불명확하면 HIGH로 보고한다.

기존 scripts/deployment-policy.mjs도 확인한다. 현재 CI는 lib/**, app/api/** 등을 보수적으로 HIGH 처리하므로, 의미상 read-only/MEDIUM이어도 해당 경로 변경은 HIGH 검토 절차를 적용한다. UI가 features/**에 있어 CI가 MEDIUM으로 표시하는 것은 정상이다. 로컬 규칙과 CI 정책은 별개이며 정책을 완화하거나 우회하지 않는다. AGENTS.md나 문서 변경을 CI가 LOW로 판단하더라도 로컬 HIGH 규칙을 우선한다.

## 검증과 diff 검토

기존 package.json scripts를 사용한다. LOW/MEDIUM의 자동 반영 전, HIGH 작업의 검증에도 다음 기본 검사를 실행한다. 하나라도 실패하거나 실행할 수 없으면 PASS로 보고하거나 자동 push하지 않는다.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

관련 테스트가 있으면 함께 실행한다. 배포 규칙/설정은 `node --test tests/deployment.test.mjs`, Workflow 변경은 actionlint, UI/권한 흐름은 필요 범위의 Playwright(`npm run test:ui`)로 확인한다. 운영 DB나 실제 매체 API를 테스트 대상으로 사용하지 않는다. 외부 시스템 검증이 필요한 작업은 별도 사용자 범위에 따른다.

검증 후 `git status --short`, `git diff --stat`, `git diff` 및 staged diff를 검토한다. 새 파일도 검토하고 요청과 관계없는 변경을 제외한다. Secret 의심 파일은 먼저 아래 방식으로 검사하고 실제 값이 출력되는 diff를 도구 로그에 남기지 않는다. 검증 후 코드가 다시 바뀌면 관련 검증을 다시 수행한다.

## Secret 및 산출물 검사

자동 push 전 검토 대상은 작업 diff/새 파일뿐 아니라 **origin/main 이후 push될 모든 commit**과 최종 staged 내용이다. 최신 파일에서 지웠더라도 중간 commit에 있는 Secret은 차단한다.

- 파일명 검사: 실제 .env, credentials/secrets, private key/certificate, database dump/로컬 DB, node_modules, .next/out/build artifact, 테스트 산출물이 포함되지 않도록 한다. .env.example도 실제 값이 있으면 금지한다.
- 내용 검사: 사용 가능한 Secret scanner의 redaction 모드를 우선 사용한다. scanner가 없다면 로컬 검사로 private-key header, 공급자 API/token 패턴, 비밀번호가 포함된 DB URL, AUTH_SECRET/API_KEY/TOKEN/PASSWORD 등의 literal 할당과 고엔트로피 문자열을 검사한다. 출력은 파일명·줄 번호·분류만 허용하며 일치 문자열은 출력하지 않는다.
- 후보가 있으면 자동 반영을 중지하고, 환경변수/Cloudtype secret 참조인지 아니면 실제 credential인지 안전하게 확인한다. 이름이 일치한다는 이유로 참조를 Secret 실값으로 단정하지 않으며, 실제 credential은 절대 허용하지 않는다. 명백한 비작동 테스트 fixture/placeholder만 근거를 확인해 구분한다.
- scanner 미탐지는 안전 보장이 아니다. diff 검토를 병행한다. 검사 불가, binary/의심 항목 미해결, 실제 Secret 발견 시 push하지 않는다. 발견 내용을 원문으로 보고하지 않는다. 이미 존재하던 이력을 임의 rewrite하지 않는다.

## Stage, commit, push

LOW/MEDIUM은 아래 조건을 모두 충족하면 사용자의 반복 승인을 요구하지 않고 commit/push까지 완료한다. 이는 향후 안전한 작업에 대한 사용자 사전 승인이다.

1. 요청 범위의 작업과 검증 완료, HIGH 변경 없음, 사용자 push 금지 없음.
2. 현재 branch가 main이며 origin의 fetch 및 모든 push URL이 정확히 dlsfhd3199-maker/intentbridge를 가리킨다. HTTPS/SSH 표기는 허용하지만 다른 호스트/저장소/추가 push 목적지는 금지한다. URL에 credential이 있다면 출력하지 않는다.
3. `git fetch origin`으로 원격 상태를 갱신하고 `git rev-list --left-right --count origin/main...HEAD` 등으로 관계를 확인한다. 원격이 앞섰거나 분기되었으면 임의 pull/rebase/merge 없이 알리고 중지한다. 연결 실패로 최신 원격 상태를 확인할 수 없어도 자동 push를 보류한다.
4. origin/main 이후 기존 미전송 commit도 확인한다. 자신의 승인된 작업 외 commit이 섞여 있거나 HIGH/Secret/소유권이 불명확하면 함께 push하지 않는다.
5. `git add -- <검토한 파일...>`로 해당 작업만 stage한다. 무조건 `git add .`를 쓰지 않는다. 같은 파일의 기존 사용자 변경이 섞이면 안전하게 분리 가능한 자신의 hunk만 stage하며, 불가능하면 중지한다. 기존 staged 사용자 변경을 commit에 섞거나 임의 unstage하지 않는다.
6. `git diff --cached --check`, `git diff --cached --stat`, 안전하게 검토한 staged diff로 실제 commit 내용을 확인하고 Secret 검사를 완료한다.
7. commit prefix는 ui:, feat:, fix:, refactor:, chore:, docs:. 예: `ui: refine super admin dashboard`. commit 후 SHA와 내용을 확인한다.
8. push 직전 branch/remote/outgoing commit을 다시 확인하고 `git push origin main`을 실행한다. 작업이 진행되는 동안 새 사용자 변경이 생기면 무조건 포함하지 말고 다시 검사한다.

push 실패 시 `git push --force`, `git push -f`, `--force-with-lease` 등 모든 강제 push를 금지한다. 원격 선행/보호 규칙/인증 오류를 설명하고 로컬 commit을 보존한다. 자동 merge/rebase로 해결하지 않는다.

## HIGH 및 migration 승인

HIGH 작업은 수정과 검증 후 **"HIGH RISK 변경이므로 GitHub Push 전 검토가 필요합니다."**라고 알린다. 변경 파일/영향/검증 결과와 미확인 사항을 제시한다. 이번 일반 운영 규칙에 대한 동의는 미래 HIGH 변경의 승인이 아니다. 사용자가 해당 변경을 명시적으로 승인한 뒤에만 동일한 Git/Secret 검사를 거쳐 commit/push한다. 승인 후 범위가 바뀌면 다시 검토한다.

새 migration은 파일/SQL, destructive 여부, 기존 데이터 영향, recovery/rollback 가능성, Staging DB 준비 여부를 확인하고 불확실성을 보고한다. 사용자 승인 전 push 금지. DB 작업 승인은 코드 push 승인과 별개다. 자동 migration/seed/reset을 실행하지 않는다.

HIGH push 승인은 CI reviewed_sha 우회나 DB 준비 완료의 의미가 아니다. push 후 CI가 막으면 검토 대상의 **전체 40자 SHA**를 제공한다. 사용자가 수동 승인할 수 있도록 안내하며 workflow_dispatch의 reviewed_sha를 임의 제출하지 않는다.

## Push 후 Actions 및 완료 보고

push 성공 후 가능하면 GitHub CLI/연결 도구로 `.github/workflows/cloudtype-staging.yml`의 **push한 SHA와 일치하는 실행**을 찾고 Policy → Quality Gate → Deploy and Health 상태를 확인한다. 이전 실행의 성공을 현재 배포 성공으로 보고하지 않는다. 문서만 바뀌어 Deploy가 skip되거나 이전 미배포 HIGH 변경 때문에 막히는 경우 실제 상태대로 설명한다. 정책/baseline/마지막 정상 태그를 성공 표시 목적으로 수정하지 않는다.

조회가 불가능하면 push 성공까지만 보고하고 사용자가 Actions를 확인해야 한다고 알린다. 실행 중이면 시작/진행 중, 실패면 실패라고 쓴다. Health 성공 전 배포 완료라고 말하지 않는다. 실행을 기다리는 동안 간결하게 상태를 알린다.

일반 완료 보고:

```text
작업 완료
Risk: LOW 또는 MEDIUM
Tests: PASS (실제 결과)
Build: PASS (실제 결과)
Commit: <short SHA>
Push: main 완료
Cloudtype: <해당 SHA의 실제 Actions 상태 또는 조회 불가>
변경:
- 핵심 변경
```

HIGH 완료 보고:

```text
작업 완료 / Push 대기
Risk: HIGH
Tests: <실제 결과>
Build: <실제 결과>
Push: 보류
HIGH RISK 변경이므로 GitHub Push 전 검토가 필요합니다.
검토 필요:
- 변경 파일과 영향
```

이 규칙을 최초 작성하는 작업은 HIGH다. 지침 작성·검증·Git 상태 확인까지만 수행하고 commit/push하지 않는다. 이는 최초 작성 작업에만 적용하며 이후 승인된 LOW/MEDIUM 자동 반영을 금지하는 규칙이 아니다.
