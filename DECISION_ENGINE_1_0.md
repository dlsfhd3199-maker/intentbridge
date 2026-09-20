# Decision Engine 1.0

IntentBridge의 기존 Dashboard → Journey → Campaign Studio → Operations → Reports 흐름에 같은 규칙 기반 운영 신호를 연결한다. LLM, 새 외부 API, 실제 광고 집행은 사용하지 않는다.

## 데이터와 계산

- `types/decision.ts`: Demo/Real 공통 정규화 입력, Signal, Evidence, Audience, 상태 모델.
- `lib/decision/engine.ts`: 입력에만 의존하는 순수 함수. 6개 규칙, 심각도·고객 영향·매출 영향·변화 폭·신뢰도 우선순위, 고정 ID 동점 정렬.
- `lib/decision/thresholds.ts`: 모든 판단 임계값과 읽기 전용 설명. 단계 전환율은 양 기간 이전 단계 30명 이상에서 -3%p/-7%p를 사용한다. 작은 표본의 비율 변화는 추천에서 제외한다.
- `lib/decision/comparison.ts`: UTC 날짜 기준 현재 7/14/30일과 바로 앞의 동일 길이 기간. 기준일을 입력으로 받으며 엔진 내부에서 현재 시간이나 난수를 사용하지 않는다.
- `lib/decision/demo-normalizer.ts`: 기존 Journey/Performance 합계와 Campaign 관측값을 재사용. 현재 7/14/30일을 중첩된 30일 이력으로 구성하며 금융 일별 값은 기존 Performance 추이와 동일하다.
- `data/mock/decision-history.ts`: 기존 데이터에 없는 이전 30일 및 캠페인 반응 비교의 **명시적 합성 Demo fixture**. 기존 핵심 데이터 합계를 변경하지 않는다. 캠페인 직전 반응률은 같은 길이의 합성 정상 운영 시나리오이며 실측 이력이 아니다. 화면 근거에 이 사실을 표시한다.
- 실제 GA4 모드에서는 Demo 비교로 대체하지 않는다. 실측 순차 여정/직전 기간 정규화 입력이 없는 현재 버전은 데이터 준비 필요 신호만 제공한다. 향후 어댑터가 같은 입력 계약을 공급하면 엔진을 재사용할 수 있다.

성과 KPI 악화는 한 신호로 묶는다. 고객 여정은 가장 큰 전환율 하락 한 구간을 제시한다. 빈도 상승만으로 소재 피로를 생성하지 않으며 CTR/CVR 악화가 함께 있어야 한다. 연결 오류·데이터 없음·24시간 이상 갱신 지연은 구매/회수/성과 판단을 중지시킨다. 비교값이나 분모가 없으면 변화율을 만들지 않는다.

## 모집단과 실행

재공략 고객은 기존 Funnel 세그먼트의 **가장 깊은 행동 기준 / Purchase 제외 / 재공략 가능 / 유입 소스 / min(선택 기간, 세그먼트 기간)** 조건을 그대로 쓴다. 30일 Brand A의 장바구니 14일 그룹은 152명이다. 이는 원래 Demo의 집계 결과이며 요청에 쓰인 예시 198명으로 바꾸지 않는다.

Audience 미리보기와 Campaign 전달은 `newCampaignDraft` / `evaluateCampaign`을 호출한다. 구매 예측이나 비용 산식을 새로 만들지 않는다. 미리보기는 Meta Mock 기본 예산/기간 조건을 공개하고, Campaign Studio에서 사용자가 채널·메시지·예산을 변경한다. Naver/Google은 기존 Coming Soon 상태를 유지한다.

원본 Signal ID·제목·비교 근거·출처·원래 고객 그룹/기간은 기존 `CampaignOrigin.recommendation`에 저장한다. Campaign 편집 후에도 원래 이유는 남고 현재 조건과 Forecast는 기존 엔진이 다시 계산한다. 초안 생성은 실제 대응 완료로 자동 취급하지 않는다.

## 상태와 접근 범위

NEW / REVIEWING / ACTIONED / DISMISSED는 기존 `intentbridge:operations:v1:<advertiserId>` 문서의 선택 필드 `signalStates`에 저장한다. 동일 입력의 신호 ID가 안정적이므로 새로고침 뒤에도 숨김 상태를 유지한다. 기간 또는 근거가 달라지면 새로운 신호로 취급한다. Operations에서 숨긴 신호를 다시 보고 복원할 수 있다.

기존 서버 문서 저장 API의 권한 검사·revision 충돌 검사·원자적 저장·감사 로그를 사용한다. 상태 선택은 운영 검토 기록이며 자동 집행을 의미하지 않는다. 저장 실패 시 성공으로 표시하지 않는다.

SUPER_ADMIN은 기존 서버가 반환한 전체 광고주, MANAGER는 기존 배정 조회 결과만 집계한다. Dashboard는 광고주별 최고 우선순위 최대 5개, Operations는 전체, Reports는 최대 3개를 보여준다. ADVERTISER는 변경/설계 없이 주요 변화와 검토·초안 상태를 조회한다. 데이터 로딩은 기존 접근 검사된 platform/GA4 status/workspace-documents GET을 사용하며 provider snapshot/test 호출을 추가하지 않는다.

Auth/Permission/Membership/Tenant Guard, PostgreSQL schema, migration, 환경변수, 배포 파이프라인은 수정하지 않았다. 기존 Campaign/Simulation/Forecast 산식과 원본 Demo JSON도 변경하지 않았다.

## 검증

`tests/decision.test.ts`: 6개 규칙, 임계값/분모/기간, 신뢰도, 데이터 이상 우선, 결정성/중복, 모든 광고주·기간의 Audience/Forecast 일치, 원본 문맥과 역할 범위.

`tests/browser/decision-engine.spec.ts`: Journey 강조, 미리보기/채널/Campaign 전달, 저장 후 원본 복원, 검토/숨김 새로고침, 보고서 재사용, 기간 전환, MANAGER 배정 범위, ADVERTISER 조회 전용/403, 390px, 연결 오류 우선, 외부 호출 없음.

일반 실행: `npm run dev`. 필수 검증: `npm run typecheck`, `npm run lint`, `npm test`, `node --test tests/deployment.test.mjs`, `npm run build`, `npm run test:ui`. 브라우저 검증은 기존 격리 DB/Mock 서버 구성만 사용한다.
