# IntentBridge Product Reality Audit 1.0

## Product Definition

**광고 성과와 고객 행동을 연결해, 무엇을 확인하고 어떻게 대응할지 보여주는 광고 운영 의사결정 플랫폼**

DATA → SIGNAL → ANALYSIS → DECISION → ACTION PLAN → REPORT

현재 제공 범위는 데이터 조회·연결 상태 확인, 고객 여정 분석, 규칙 기반 신호, 고객 조건, 성과 시뮬레이션, 내부 실행안 저장·내보내기, 운영 제안 검토·기록이다. 외부 광고 플랫폼에서 생성·예산 변경·On/Off·고객 전송·소재 등록·입찰 변경·자동 운영·복구를 수행하지 않는다.

## 주요 변경과 실제 동작

| 기존 표현 | 문제 | 변경 표현 | 실제 기능 | 향후 Real API 확장 조건 |
|---|---|---|---|---|
| Campaign Studio / 캠페인 관리 | 실제 광고 생성 화면으로 오인 | 재공략 실행안 / 실행안 | 고객 조건·검토 채널·메시지안·예산안 저장 | 별도 쓰기 Adapter와 매체 검증 필요 |
| Mock 캠페인 생성 | 외부 캠페인 생성으로 오인 | 실행안 저장 | 내부 READY 기록과 버전 저장 | 외부 생성 결과·ID·실패 처리 필요 |
| Mock 활성화 / 일시중지 | 광고 On/Off로 오인 | 검토 완료로 표시 / 보류로 표시 | 기존 MOCK ACTIVE / PAUSED 상태와 Demo 관측 예시 유지 | 실제 집행 상태 조회와 쓰기 구분 필요 |
| 광고 운영 / Operations | 외부 계정 조작으로 오인 | 운영 제안 | 조건에 맞는 제안과 안전 제한 확인 | 쓰기 승인·실행·확인 단계를 별도로 구현해야 함 |
| Mock 적용 / APPLIED IN MOCK | 외부 반영 또는 단순 체크로 오인 | 실행안에 반영 / 실행안 반영 완료 | 내부 예산·메시지·고객 조건·상태 변경 및 이력 저장 | 현재 저장 버튼을 외부 쓰기로 재사용하지 않음 |
| Rollback / 되돌리기 | 실제 광고 설정 복구로 오인 | 이전 실행안 복원 | 저장된 before 스냅샷 전체를 복원하고 새 버전 생성 | 외부 현재 상태 검증과 별도 복구 절차 필요 |
| MOCK AUTOMATION / Increase Budget 등 | 광고 예산 자동 변경으로 오인 | 운영 제안 규칙 / 예산 확대 검토 등 | 규칙 평가 후 사용자 확인으로 내부 계획 변경 | 자동 집행 기능은 제공하지 않음 |
| 시뮬레이션에 적용 | 실제 광고 반영으로 혼동 | 추천안으로 계산 | 기존 레버·계산식으로 예상 결과 갱신 | 실측 검증 없는 성과 보장 금지 |
| 모든 Signal의 공통 설계 CTA | 원인 확인보다 캠페인 생성을 유도 | 유형별 다음 행동 | 아래 매핑에 따라 기존 화면 이동 | Signal 계산 변경 없음 |
| Audience / 캠페인 미리보기 | 실제 매체 Audience 생성으로 오인 | 고객 그룹·대상 고객 조건 / 실행안 미리보기 | 조건과 합성 집계 인원 확인 | 개인 데이터·동의·매체 계약 검증 필요 |
| 운영 중 / Draft / Ready / Mock Active | 실제 광고 상태로 오인 | 초안 / 실행 준비 / 검토 완료 / 보류 | 저장 enum의 Presentation Mapping | 실제 집행 여부는 미확인으로 구분 |
| Campaign Summary / 최근 Mock 변경 | 실제 실행 작업 보고로 오인 | 실행안 요약 / 최근 실행안 변경 | 내부 검토 상태·Demo 관측 예시, 실제 집행 여부 미확인 | 실제 집행 기록을 확보할 때 별도 실적 표기 |
| 광고 연결과 집행은 데모 환경 | 데모에서 광고 집행이 가능한 것으로 오인 | 데모 데이터로 실행안을 검토하는 예시 | 공개 합성 데이터만 표시 | 쓰기 기능 추가 전 판매 문구 확대 금지 |
| 운영 시작 / 운영 정상 | 광고 운영 시작으로 오인 | 분석 시작 / 분석 준비 완료 | 기존 Workspace 설정 완료 플래그 | Workspace 설정과 외부 집행 분리 |
| 연결 중 / 정상 | 실제 API 연결로 오인 | 데모 설정 중 / 데모 연결 정상 | Demo Connector 설정 확인 | 기존 Real GA4 읽기 상태와 구분 |
| Campaign Plan HTML·CSV·JSON | 내보낸 자료에서 오해 재발 | 실행안·검토 상태·운영 제안 규칙·Handoff | 기존 Export Engine 재사용 | JSON 내부 계약은 유지하고 presentation 메타데이터 추가 |

`적용`을 무조건 치환하지 않았다. Import는 실제 내부 데이터를 반영하므로 기존 확인 절차와 “검토한 Import 적용”을 유지한다. 적용 버튼이 내부 실행안 내용까지 바꾸므로 단순 “검토 완료”로 축소하지 않았다. 복원도 단순 검토 취소가 아니라 이전 실행안 전체 복원임을 표시한다.

## Signal → Next Action

| Signal | 다음 행동 | 실행안 CTA |
|---|---|---|
| DROP_OFF | 고객 여정 확인, 해당 단계 강조 | 유효한 고객 조건·인원이 있을 때만 |
| RECOVERY_OPPORTUNITY | 고객 조건 확인 | 대상 조건 확인 모달 → 실행안 작성 |
| PERFORMANCE_DROP | 성과 원인 확인 | 공통 실행안 CTA 없음 |
| CAMPAIGN_FATIGUE | 소재·노출 빈도 검토 | 기존 실행안 검토로 이동 |
| DATA_ISSUE | 데이터 연결 확인 | 없음, 기존 연결 조회 권한 유지 |
| POSITIVE_MOMENTUM | 유지·확대 시뮬레이션 검토 | 공통 실행안 CTA 없음 |

광고주와 기간은 이동 URL에 유지한다. ADVERTISER 조회 전용, MANAGER 배정 범위, SUPER_ADMIN 범위와 모든 기존 변경 권한 검사는 그대로 사용한다. Signal 임계값·우선순위·6종 생성 계산은 변경하지 않았다.

## Source, Audience, Forecast, Handoff

- GPT Organic은 유입 분석과 고객 조건으로만 사용한다. 실행안 검토 채널 목록에 ChatGPT Organic을 추가하지 않는다. ChatGPT Ads는 Experimental / Planned로 안내한다.
- Meta는 기존 Demo 계산을 지원한다. Naver·Google 등은 기존 지원 수준에 따라 조건 검토와 초안 저장만 가능하며, 저장 가능 조건·계산·비활성 동작은 유지한다.
- 고객 그룹은 조건·기간·구매 제외·집계 인원으로 표현한다. 가짜 고객 이름·이메일·전화번호·개인별 목록을 만들지 않았다. 조건을 실행안에 담아 기존 CSV/HTML/JSON으로 내보낼 수 있다.
- 모든 Forecast는 기존 숫자·공식·반올림·모집단을 유지한다. DEMO FORECAST와 가정·성과 미보장 설명을 유지하며, 실제 관측과 구분한다.
- 실행안 완료 단계와 내보낸 문서에서 마케터가 실제 광고 플랫폼에서 집행해야 함을 안내한다. 새 Export Engine이나 외부 쓰기 기능은 추가하지 않았다.
- 기존 사용자 작성 이름·메시지와 저장된 enum은 보존한다. 알려진 시스템 상태·활동·알림만 표시 시 변환한다. JSON은 원본 `campaign`, `rules`를 유지하고 외부 실행 미수행 메타데이터를 덧붙인다.

## 전수 검토 범위

Public Website·공개 미리보기·메타 설명, Dashboard(최고 관리자/담당자/광고주), Journey·조건·미리보기, Performance, 실행안 편집·목록·상세·버전·초안·비교, 운영 제안·규칙·이력·알림, Reports와 GA4 실측/Mock 구분, Connections·아키텍처 준비도, Workspace Onboarding·검색·최근 활동, Empty State·Button·Modal·Toast·Help·Status, HTML/CSV/JSON Export를 검토했다.

검색어: Create Campaign, Launch, Publish, Apply, Rollback, Activate, Auto Optimize, Audience Sync, Campaign Created, Active Campaign, 캠페인 생성/만들기, 자동 운영, Mock 적용 등. 내부 함수·enum·권한 이름·원천 유입 캠페인 attribution·사용자 작성 내용은 변경 대상에서 제외했다. reference HTML도 변경하지 않았다.

Auth.js, 비밀번호·Session, Role/Permission, Membership, Tenant Isolation, DB Schema, Secret/env, Workflow/Deployment 구현은 변경하지 않았다. 브라우저 보안 회귀 테스트의 사용자 노출 버튼 선택자와 상태 기대 문구는 새 UX에 맞춰 갱신했으며, 권한·403·DB 원자성·지속성 검증을 삭제하거나 완화하지 않았다.

## 검증 및 Git 정책

최종 검증 결과:

| 검증 | 결과 |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | 81 / 81 PASS |
| `node --test tests/deployment.test.mjs` | 32 / 32 PASS |
| `npm run build` | PASS |
| `npm run test:ui` | 83 / 83 PASS · skip 없음 |
| 작업 diff Secret 검사 | 후보 0건 |
| `git diff --check` | PASS |

브라우저 검증은 격리 로컬 DB와 Demo 데이터에서 실행했다. 실행안 저장·검토·보류·복원·세 가지 내보내기, Organic 유입/검토 채널 분리, Recovery·Performance·Positive·Data Issue 이동, 외부 요청 없음, 전체 역할·Tenant 회귀, 공개 화면과 모바일/데스크톱을 포함한다. 최초 실행의 5개 실패는 새 문구와 일치하지 않는 기대값/선택자였으며 수정 후 전체 재검증했다. timeout 증가·skip·검증 삭제는 없다. 내보낸 실행안 HTML도 시각 확인했다.

기존 Deployment Policy는 아래 테스트 파일의 변경을 `DEPLOYMENT_INFRASTRUCTURE / Security gate regression coverage`로 분류한다:

- `tests/browser/agency-roles.spec.ts`
- `tests/browser/foundation.spec.ts`
- `tests/browser/permissions.spec.ts`
- `tests/browser/security.spec.ts`

따라서 실제 보안 구현 변경이 없어도 더 엄격한 CI 분류를 따라 **MANUAL_REVIEW / HIGH**로 처리한다. 정책을 변경하거나 테스트를 분리하여 AUTO로 우회하지 않는다. 검증 후에도 이번 변경에 대한 별도 Git 반영 승인 전까지 commit/push 및 Staging 배포를 보류한다.
