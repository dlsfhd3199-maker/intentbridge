> **현재 인증 안내:** 이메일·비밀번호 회원가입과 관리자 승인 방식으로 전환했습니다. 아래 과거 Magic Link/필수 Resend/DB Session 안내보다 [AUTH_CREDENTIALS_MIGRATION.md](AUTH_CREDENTIALS_MIGRATION.md)가 우선합니다. 기존 계정은 비밀번호 초기 설정과 재로그인이 필요합니다.

# 현재 실행 안내

현재 인증·서버 DB 기반 앱입니다. 아래 과거 단계별 기록의 Mock Role/미구현 설명보다 [DEPLOYMENT.md](DEPLOYMENT.md)와 [AUTH_ARCHITECTURE.md](AUTH_ARCHITECTURE.md)가 우선합니다. 개발은 `APP_ENV=development`, SQLite 설정 후 `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run dev` 순서입니다. Staging/Production은 별도 PostgreSQL migration을 사용합니다.

| 분류 | 항목 | 보관 |
| --- | --- | --- |
| PUBLIC | 제품명, Mock/Forecast 라벨 | UI |
| SERVER ONLY | APP_ENV, AUTH_URL, AUTH_EMAIL_FROM, LOG_LEVEL, Rate/보존 정책 | 서버 환경 |
| SECRET | DATABASE_URL, AUTH_SECRET, RESEND_API_KEY/AUTH_RESEND_KEY, GA4 자격 증명 | 호스팅 Secret 저장소; NEXT_PUBLIC 금지 |

[Staging 체크리스트](STAGING_CHECKLIST.md) · [Production 체크리스트](PRODUCTION_CHECKLIST.md)

# IntentBridge · 실제 로그인 / Workspace / 서버 저장

현재 실행 방법·인증 설정·DB 마이그레이션·권한·보안 검증은 [AUTH_ARCHITECTURE.md](./AUTH_ARCHITECTURE.md)를 먼저 확인하세요. 로그인과 DB 준비가 필요하며, 아래 과거 단계의 Mock Role / LocalStorage 실행 안내는 현재 런타임을 설명하지 않습니다. 기존 광고 계산과 화면은 유지하고 저장 계층을 서버로 전환했습니다.

# IntentBridge · 6차 API 연결 전 MVP

새 Next.js App Router + TypeScript + Tailwind CSS 프로젝트입니다. 기존 `reference/` HTML은 수정하지 않았습니다.

## Windows에서 실행하기

1. Node.js 22 LTS 이상을 설치합니다. 검증 환경은 Node.js 24입니다.
2. 이 폴더를 열고 주소창에 `cmd`를 입력한 뒤 Enter를 누릅니다.
3. 처음 한 번 `npm install`을 입력합니다. 패키지를 내려받을 때 인터넷이 필요합니다.
4. `npm run dev`를 입력합니다.
5. 브라우저에서 http://localhost:3000 을 엽니다.
6. 종료하려면 명령창에서 `Ctrl+C`를 누릅니다.

PowerShell에서 실행 정책 오류가 발생하면 `npm` 대신 `npm.cmd`를 사용하거나 위의 명령 프롬프트(cmd)로 실행하세요.

완성 빌드는 `npm run build`, 빌드한 앱 실행은 `npm start`입니다. 이미 같은 포트의 앱이 실행 중이면 먼저 종료하세요.

## 이번 단계에서 구현한 화면

- `/`: 광고주 A/B 선택, 7/14/30일 변경, 핵심 KPI 6개, 퍼널 요약, 미구매·재공략 대상, 직접/회수 구매·매출 비교, 유입 채널.
- `/funnel`: 캠페인·채널 개요, KPI 6개와 펼침 행동 지표 4개, 단계 선택·전환율·이탈 수·자동 병목, Organic/Ads 필터와 비교 표, 이벤트 기반 Segment Builder, 조건을 변경하는 Audience Builder, 리타겟팅 미리보기.
- `/performance`: 현재 성과·병목 진단, 6개 레버, 보수적/추천/공격적 시나리오, Current/Forecast 비교, 차트 2개, Breakdown, 규칙 기반 추천 적용, What-if, Confidence, 광고주·기간별 설정 저장.
- `/campaigns`: Audience·채널·목표·메시지·예산·Forecast·Review, 광고 미리보기, 초안/Mock READY 생성, 상태별 목록과 상세, Simulation 가져오기.
- `/operations`: 캠페인 모니터링, 상태 진단, AND Rule Builder, Mock 추천 적용·되돌리기, 변경 이력·버전, Alert, Simulation/Campaign 비교, 설계안 Export.
- `/reports`: Executive KPI·Funnel·Performance·Campaign·Operations·Insight 요약과 독립 HTML Export.
- `/connections`: 9개 Connector 준비도·상세·의존 관계, App Settings, Data Backup/Import.

광고주·기간 선택은 화면 이동 중 유지됩니다. Campaign Studio는 URL의 광고주·기간과 해당 광고주의 초안을 새로고침 후 복원합니다. Campaign/Operations는 URL의 광고주·기간을 복원합니다. 그 외 직접 새로고침은 브랜드 A와 App Settings의 기본 기간으로 시작합니다. Funnel의 소스 필터·선택 단계·Audience 조건은 광고주/기간 전환 시 초기화됩니다.

채널 Dropdown은 ChatGPT/Naver/Google/Meta/Kakao/YouTube/Affiliate/CRM/기타를 선택할 수 있습니다. ChatGPT → Meta 외 조합은 데이터 준비 예정 상태를 보여주며, 다른 매체의 수치로 위장하지 않습니다.

## 데이터 기준

- 원본은 `mock/mock-data.json`입니다. 참고 HTML과 수치가 다르면 이 JSON이 우선입니다.
- 브랜드 A 30일: 직접 41건 + 회수 53건 = 총 94건, 매출 13,690,000원, 광고비 3,200,000원, ROAS 약 427.8%.
- 7일·14일은 각각 원본의 24%·49%를 반올림한 **예시 스냅샷**입니다. 실제 날짜 필터·시계열 데이터가 아닙니다.
- 유입 채널 합계가 Unique와 일치하도록, 세그먼트 합계가 Audience와 일치하도록 집계합니다.
- 미구매는 생성된 익명 Mock 여정에서 직접/회수 구매 이벤트가 없는 고객을 집계합니다. 브랜드 A 30일은 1,190명입니다. 실제 사용자 기록이 아닙니다.
- 2차 Funnel은 원본 합계를 보존하는 합성 여정을 생성합니다. 소스별 세션·행동·매출·이벤트 경과일은 Mock에서 결정적으로 배분합니다. 실제 날짜나 개인 사용자 데이터가 아닙니다.
- 세그먼트는 구매 고객을 제외하고 가장 깊은 행동으로 중복 없이 분류합니다. 브랜드 A 30일은 결제진입 7D 80명 / 장바구니 14D 152명 / 상품조회 30D 510명, 합계 742명입니다. 1차의 고정 세그먼트 예시 값은 그대로 두고, 새 Funnel 화면만 이벤트 기준으로 집계합니다.
- 직접 구매 후 미구매는 1,243명, 기간 내 회수 구매 53명까지 제외한 현재 미구매는 1,190명입니다. 현재 재공략 대상 742명과 기간 내 회수 구매는 시점이 다르므로 이 둘로 회수 전환율을 계산하지 않습니다.
- Audience Builder: 선택한 Source OR 조건 AND Event OR 조건 AND Mock 자격 플래그. Window는 분석 기간과 선택 Window 중 짧은 기간을 적용하며, 이벤트 경과일 경계를 포함합니다. 겹치는 이벤트는 코호트당 한 번만 집계합니다.
- Purchase 제외 OFF는 비교용 사용자 정의 Audience에만 적용됩니다. 자동 세그먼트·리타겟팅 미리보기는 구매자를 항상 제외합니다. 소스나 이벤트가 모두 해제되면 0명으로 표시합니다.
- 미리보기는 선택된 자동 세그먼트를 사용하며 사용자 정의 Audience 조건과는 독립적입니다. 예상 구매 = 대상 × 세그먼트별 가정 전환율(반올림), 예상 비용 = 대상 × 인당 가정 비용, 예상 CPA = 비용 / 예상 구매. 0건이면 CPA는 산출 불가입니다. 모든 예상값에 DEMO FORECAST를 표시하며 실제 생성·집행은 없습니다.
- Source 비교의 Purchase/Revenue/CVR은 직접 구매 기준입니다. 통합 매출에는 회수 매출도 포함합니다. 소스별 광고비는 유입 인원 비중으로 가정 배분하므로 실제 매체 지출이 아닙니다.
- 구매는 Mock에서 중복 없는 직접/회수 경로로 가정합니다. CPA = 광고비 / 총 구매, ROAS = 매출 / 광고비 × 100.

## 파일 구조

```text
app/                    페이지 경로, 공통 레이아웃, Tailwind와 스타일
components/             사이드바, 광고주·기간 선택, KPI
features/dashboard/     홈 대시보드, 퍼널 요약
features/workspaces/    두 Workspace 진입 화면
features/funnel/        완성된 Funnel, Audience, Preview 및 전용 스타일
features/performance/   Performance Lab, 비교 차트 및 전용 스타일
lib/connectors/          4종 Connector Interface와 Mock 구현
lib/connectors/funnel.ts 추가 Mock 이벤트 Connector
lib/funnel.ts           퍼널·병목·세그먼트·Audience·Forecast 계산
lib/dashboard.ts        Connector 조합 및 통합 KPI 계산
lib/simulation.ts       순수 Forecast·진단·비교 계산
lib/simulation/         Baseline 조합·광고주별 설정 저장·공식 설명
lib/recommendations.ts  현재 데이터와 Forecast에 따른 규칙 기반 추천
data/mock/              원본 Mock JSON을 기간별 스냅샷으로 변환
types/                  데이터 계약과 확장 가능한 SourceId
tests/                  데이터 정합성 및 브라우저 검증
```

기존 UI → dashboard service → Source / Analytics / Retargeting / Ads Connector → Mock repository 구조를 유지했습니다. Funnel은 별도의 MockFunnelConnector와 `data/mock/funnel-repository.ts`를 추가해 기존 홈/Performance 진입 화면에 영향을 주지 않습니다. UI는 서비스의 집계 결과만 사용하며 개별 여정 대신 익명 코호트로 Audience를 계산합니다. `types/funnel.ts`에 Campaign, TrafficSource, FunnelStage, AudienceSegment, RetargetingCampaign, Conversion, Revenue 계약을 추가하고 기존 Advertiser를 재사용합니다. 외부 API 호출·인증·토큰 입력·비밀키·개인 사용자 목록은 없습니다.

## 검증

```text
npm run build
npm run typecheck
npm test
npm run test:ui
```

브라우저 검증은 Windows에 설치된 Microsoft Edge와 별도의 3100번 포트를 사용합니다. `npm run build` 후 실행하세요. 사용자의 3000번 개발 서버는 종료하지 않습니다. 데스크톱 1366/1440/1920과 모바일 390/320 폭, 광고주·기간·소스 전환, 퍼널 단계·세그먼트 선택, Audience 조건, 채널 조합, Preview 열기/닫기, 브라우저 오류 및 외부 요청 여부를 검사합니다.

## 3차 Simulation 계산 요약

기존 Baseline(A 30일 총구매 94건)을 유지합니다. 유입 광고비는 Paid 유입에 비례하고 Organic은 고정합니다. Landing/Cart/Checkout의 상대 전환율 개선을 순차 적용하고 각 전환율을 100% 이하로 제한합니다. 회수 구매는 합성 재공략 풀과 기존 회수율에 효율·예산 배수를 적용합니다. 매출은 직접/회수별 고정 평균 주문액, 광고비는 변경된 두 예산 합계로 계산합니다.

브랜드 A 추천 Preset의 DEMO FORECAST는 직접 55 + 회수 69 = 총 124건, 매출 18,059,103원, 광고비 3,372,500원입니다. 실제 성과 예측이 아닙니다. 0건 CPA·0원 광고비 ROAS는 산출 불가로 표시합니다. 전후 악화도 표시하며, Breakdown 합계는 전체 구매 변화와 일치합니다.

Confidence는 변경 폭에 따른 등급입니다. 실제 예측 정확도/성공 확률이 아닙니다. 저장은 Mock Simulation 설정과 결과만 포함하며, 복원할 때 현재 Baseline으로 다시 계산합니다.

전체 공식·반올림·진단 기준·추천 조건·저장 방식은 [Simulation 설명](lib/simulation/README.md)에 있습니다.

검증에는 레버 최소/최대 64조합 × 광고주 2개 × 기간 3개, Reset, Forecast 합계, 0/NaN 방어, 추천 변화, 저장 복원과 브라우저 조작·회귀 검사를 포함합니다. 새로운 외부 라이브러리나 API를 추가하지 않았습니다.

## 4차 Campaign Studio

Home의 캠페인 만들기, Funnel의 선택 세그먼트, Performance의 개별 추천에서 진입합니다. Performance는 원본 시나리오·레버·Forecast를 그대로 보관하고, 추천 출처와 추천 예산 변경을 별도로 전달합니다. 저장된 Simulation도 광고주·기간별 마지막 설정에서 가져옵니다. 원본 전체 퍼널 Forecast와 선택 Audience의 Campaign Forecast를 구분해 표시합니다.

- 데이터 경로: 기존 Mock Repository / Connector → `lib/campaign-service.ts` → `features/campaigns/campaign-studio.tsx`.
- 타입은 `types/campaign.ts`, 매체 지원 상태·CPM·메시지 템플릿은 `data/mock/campaign-config.ts`에 있습니다. 기존 Funnel의 Campaign 계약을 변경하지 않았습니다.
- `lib/campaign-message.ts`는 세그먼트·제품·병목 기반 메시지를 추천합니다. `lib/campaign-naming.ts`는 이름과 URL 인코딩한 UTM을 생성합니다.
- 초기 일 예산 = 기존 재공략 지출 / 분석 기간 × 추천 예산 배수 × 세그먼트 / 전체 재공략 Audience. 마지막 수정한 일/총 예산을 기준으로 기간 변경을 반영합니다.
- `lib/campaign-forecast.ts`: 노출 = min(예산 / CPM × 1,000, Audience × 기간 내 Frequency). 도달 = ceil(노출 / Frequency), 클릭 = 노출 × CTR, 구매 = 클릭 × CVR를 반올림하고 도달/클릭/구매를 각각 상위 인원으로 제한합니다. 매출은 구매 × 기존 회수 구매 평균 주문액입니다.
- CPA/ROAS는 기존 `lib/simulation.ts`의 공통 금융 계산을 재사용합니다. 분모는 Audience 포화 후 실제로 사용할 수 있는 **Mock 집행 비용**입니다. 남는 예산도 표시합니다. 0분모는 산출 불가, 음수/NaN/Infinity는 0으로 정규화합니다. No Limit도 Mock에서는 5회/일로 제한합니다.
- ChatGPT → Meta만 Mock 생성 가능하며 나머지 조합, Lead/Custom 측정은 Coming Soon입니다. 초안 보관은 가능합니다. Purchase 제외 OFF는 비교용이며 READY 생성 시 ON이 필요합니다.
- 자동 검증 후 DRAFT → READY로 저장하고 Mock ID를 부여합니다. READY/PAUSED → MOCK ACTIVE → PAUSED는 로컬 상태 변경입니다. 생성 후 편집은 새 초안으로 분리하며 중복 생성 클릭은 동일 ID를 반환합니다.

### 저장 방식

`lib/campaign-store.ts`의 `intentbridge:campaigns:v1:<advertiserId>`에 최신 편집 초안, 여러 초안 목록, 캠페인 목록, 버전, lastEdited를 저장합니다. 기존 4차의 최신 초안 및 DRAFT 캠페인은 새 목록으로 이전합니다. 기간을 바꿔도 이전 초안은 Library에 유지되며 다시 열 수 있습니다. 저장된 캠페인 목록에는 각 생성 기간과 설정/Forecast 스냅샷이 유지됩니다. LocalStorage를 사용할 수 없으면 현재 탭의 메모리에 보관합니다. 손상된 저장 데이터는 복원하지 않습니다.

화면 간 전달은 `intentbridge:campaign-handoff:<id>`에 저장한 Mock 설정만 사용합니다. 개인 고객 식별자, 계정 인증 정보, 토큰은 저장하지 않습니다. Simulation은 기존 `intentbridge:simulation:v1:...` 저장 구조를 유지합니다. UTM의 source는 재공략 매체이며 원본 유입 캠페인 ID/Source는 별도로 보관합니다.

## 5차 Operations Center 사용하기

1. Campaign Studio에서 Mock 캠페인을 생성하고 상세의 **Mock 활성화**를 누릅니다. READY는 미집행 상태로 관측값이 0입니다.
2. **Operations Center**에서 광고주·기간·Status를 선택합니다. 작은 Audience 또는 적은 구매에서는 LIMITED/LEARNING 표시가 정상입니다.
3. 캠페인별 Target CPA/ROAS와 예산·Audience Guardrail을 저장합니다.
4. Metric / Operator / Value로 조건을 만들고 AND를 추가합니다. **Automation Preview**에서 매칭 여부, 근거 수치, 변경 전후 예산과 DEMO FORECAST를 확인합니다.
5. 규칙 저장 후 **오늘의 운영 액션 → 검토 → Mock 적용**을 누르면 로컬 캠페인 상태만 변경됩니다. 이력에 `APPLIED IN MOCK`이 남고 새 버전이 추가됩니다.
6. Change History의 **되돌리기**는 이전 상태를 복원하고 `ROLLBACK` 이력·버전을 추가합니다. 후속 변경이 있으면 가장 최근 변경부터 되돌려야 합니다.

외부 API, 광고계정, OAuth, 실제 예산 변경, 이메일/Slack 전송, 백그라운드 자동 실행은 없습니다. 규칙은 제안을 생성하고 사용자의 클릭으로만 적용합니다.

### Engine과 관측 데이터

- `types/operations.ts`: 규칙·조건·액션·Health·추천·이력·버전·Alert·Guardrail·Export·SavedSimulation 계약.
- `data/mock/operations-config.ts`: 세그먼트별 합성 관측 비율, 기본 목표와 Guardrail, Metric/Action 목록.
- `lib/operations-engine.ts`: 기존 캠페인/Mock 데이터를 읽고 기간별 관측 지표, AND 매칭, Preview, 우선순위·이유·근거 수치를 구성합니다. 관측값은 실제 시계열이 아닌 결정적인 Mock 스냅샷입니다. PAUSED의 관측은 중단 전 값으로 취급합니다.
- 관측 Reach는 Audience × 세그먼트별 도달 비율 × 기간 비율, 노출은 Reach × Frequency와 예산/CPM의 작은 값입니다. 클릭·구매는 Mock CTR/CVR를 적용하며 매출은 기존 회수 평균 주문액으로 계산합니다. 실제 고유 사용자 기록은 없습니다.
- `lib/operations-health.ts`: Audience/Frequency 제한 → 데이터 부족 → 목표 달성 → 큰 목표 이탈 → WATCH 순서로 판단합니다. 구매 3건 미만은 LEARNING, ROAS가 목표의 75% 이하 또는 CPA가 목표의 125% 초과이면 ACTION REQUIRED입니다.
- Preview의 구매/매출 변화는 **기존 Campaign Forecast와 변경 설계의 Forecast 차이**입니다. 현재 관측 실적의 증분 성과 보장이 아닙니다. 기존 Campaign Forecast/금융 계산을 재사용합니다. 소재 교체는 메시지만 변경하며 근거 없는 CTR/CVR 상승을 가산하지 않습니다.
- Audience Expand는 같은 매체의 모든 유입 Source와 30D Window로 확장합니다. 실제 코호트가 늘어나지 않으면 적용을 차단합니다. Window Change는 3/7/14/30D만 허용합니다.

### Guardrail과 변경 이력

`lib/operations-guardrail.ts`는 최소/최대 일 예산, 1회 증액 상한, 최소 Audience, 최대 Frequency를 검사합니다. 예산 상한을 적용한 결과와 차단 사유를 Preview에 표시합니다. 예산 증감은 MOCK ACTIVE에서만 가능합니다. 잘못된 숫자·음수·0 Audience·존재하지 않는 캠페인을 처리합니다.

`lib/operations-history.ts`는 적용 직전에 최신 Rule·목표·Guardrail·캠페인 상태를 다시 확인합니다. 검토 이후 바뀐 캠페인/규칙, 처리된 액션, 동시에 중복 클릭한 요청은 다시 적용하지 않습니다. Campaign Studio의 직접 상태 변경도 User 이력으로 표시됩니다. 버전은 추가만 하고 기존 스냅샷을 수정하지 않습니다.

### Library와 Export

- Campaign Studio와 Operations에서 여러 Draft의 열기·복제·삭제를 지원합니다. 이름·생성/편집 시간·Origin·Forecast ROAS를 표시합니다.
- Performance Lab에서 이름을 입력해 **Library에 저장**합니다. 기존 광고주·기간별 자동 저장도 그대로 유지합니다. Simulation Library는 별도의 이름 있는 스냅샷이며 복제/삭제, Performance 재열기, Campaign 전환을 지원합니다.
- Simulation은 2~3개, Campaign/Draft는 2개를 비교할 수 있습니다. 다른 기간의 수치는 기간 표시를 확인하며 비교하세요.
- `lib/export-service.ts`: JSON 전체 설계안, UTF-8 BOM CSV, 외부 공유용 독립 HTML 보고서를 다운로드합니다. Audience·메시지·예산·기간·Tracking·Forecast·목표·Guardrail·규칙·Notes를 포함합니다. HTML은 외부 리소스/스크립트 없이 작동하며 입력값을 이스케이프합니다. CSV는 수식으로 실행될 수 있는 셀을 방어합니다. PDF는 포함하지 않습니다.

### 광고주별 저장 키

| 저장 키 | 내용 |
| --- | --- |
| `intentbridge:campaigns:v1:<advertiser>` | 최신 편집 초안, 여러 Draft, Campaign, Version, Last Edited |
| `intentbridge:operations:v1:<advertiser>` | Rules, Targets, Guardrails, Change History, Alert 읽음 상태, 액션 처리 상태 |
| `intentbridge:simulation-library:v1:<advertiser>` | 이름 있는 Simulation과 Baseline/Forecast 스냅샷 |
| `intentbridge:simulation:v1:...` | 기존 광고주·기간별 마지막 Performance 설정 |

모든 저장은 Mock 설정/집계만 포함합니다. 저장소 차단·용량 초과 시 현재 탭 메모리로 동작하며 이 경우 새로고침 후 복원되지 않습니다. 동시 탭 간 실시간 동기화나 서버 저장은 아직 없습니다.

6차에서 위 연결 준비·충돌 관리·일자별 추이·백업/복원을 구현했습니다. 다음 단계는 사용자의 전체 프로그램 검수입니다.

## 6차: API 연결 전 MVP 정리

### Connection Center와 설정

`lib/connections.ts`는 9개 Connector 카탈로그와 가중 체크리스트를 제공합니다. 기존 Connector → Mock Adapter → Service → UI 흐름을 유지했습니다. 실제 Adapter를 구현한 것처럼 보이는 빈 구현체는 만들지 않았습니다. `lib/connectors/base.ts`는 향후 실제 Connector의 오류·timeout·retry·rate-limit 계약만 정의합니다.

GA4/Meta Pixel/Meta Marketing 각각 70%, ChatGPT Ads 50%, 향후 5개 채널은 각각 10%, 전체 평균 **34%**입니다. 실제 인증/오류 처리/통합 검증은 모두 미완료입니다. ChatGPT Ads 환경 이름은 계획용 가칭이며 공식 제공 범위나 이용 자격을 확인한 상태가 아닙니다.

App Settings는 `intentbridge:settings:v1`에 저장합니다. 기본 기간, KRW/ko-KR, 기본 CPA/ROAS, 보고서 기본 시나리오, Compact/Comfortable을 제공합니다. 개별 Campaign 목표와 Performance Lab의 기존 저장 설정은 우선합니다. 공통 광고주/기간은 기존 AppShell Context를 재사용합니다. Custom 날짜 범위는 미지원입니다.

### Executive와 Trend

`lib/executive-report.ts`는 기존 Dashboard/Funnel/Simulation/Operations 서비스를 합성합니다. KPI 6개 → Funnel 요약 → Baseline/Forecast/Confidence → Campaign 개수·Top 3 → 최근 운영 추천/변경 → 조건별 Insight 최대 3개 순서입니다. `lib/executive-export.ts`는 내비게이션·외부 리소스·스크립트가 없는 독립 HTML을 만듭니다.

`lib/performance-trend.ts`는 선택된 기존 합계에 결정적 가중치를 배분합니다. 정수 잔여 배분으로 Spend/Traffic/Purchase/Revenue 합계가 원본과 일치하며 CPA/ROAS는 공통 함수를 사용합니다. 매출은 일별 구매 비중에 따라 배분합니다. 광고주 전체 Traffic은 Unique, 캠페인 Traffic은 Mock 클릭이며 화면에 구분합니다. 고정 종료일은 2026-09-17입니다. 7/14/30일은 각각 별도 합성 스냅샷입니다.

전일 ROAS -20% 이하 또는 직전 3일 유효 CPA 평균 대비 +25% 이상이면 Declining, ROAS -10% 미만/CPA +10% 초과/Frequency 4.5 초과는 Watch, ROAS +10% 이상 및 CPA 악화 없음은 Improving, 나머지는 Stable입니다. 분모 0은 산출 불가입니다. 차트는 비용/매출과 구매 2개만 제공합니다.

### Rule 충돌

`lib/rule-conflicts.ts`가 같은 캠페인에서 동시에 일치한 변경 규칙을 그룹화합니다. 예산 변경끼리, Window/Audience 변경끼리, 같은 액션끼리 충돌하며 Pause는 다른 변경과 충돌합니다. Notify는 독립입니다. 기본은 **Manual Review Required**, **Higher Priority Wins**는 유일한 최고 우선순위만 허용하며 동순위는 차단, **Skip Both**는 충돌 그룹 전체를 차단합니다. 우선순위는 1이 가장 높고 기존 규칙은 3입니다. Guardrail도 별도로 만족해야 합니다.

동일 Metric/Operator와 5% 또는 1 이내 조건·액션 값을 유사 규칙으로 경고합니다. 별도 강제 저장 버튼으로만 중복 생성할 수 있습니다. 실제 실행은 없고 Mock 적용 직전 최신 규칙·모드·캠페인을 재평가합니다.

### Backup / Import

`lib/backup-service.ts`와 `lib/data-migration.ts`는 Schema **1.0**의 전체 등록 광고주 모델을 취급합니다. Campaign/Draft/Version, Rule/History/Alert/Guardrail/Target/Decision/ConflictMode, 이름 있는 Simulation 및 최근 레버, 공통 설정을 포함합니다. transient handoff와 임의 저장 키는 제외합니다.

JSON 파싱, 크기(5 MB UI 제한), 깊이/배열 제한, Schema, 필수 필드, 광고주/캠페인/버전 참조, 중복 ID, 숫자·날짜·허용값, 자격 증명/프로토타입 필드를 검사합니다. 미지원 Schema는 추측 변환하지 않습니다. 기본 Merge는 기존 값 우선과 Conflict Summary를 제공하며, Campaign 충돌 시 연관 기록도 함께 보존합니다. Replace는 명시적 교체 확인이 필요합니다. 검토 후 현재 데이터가 변경되면 적용을 막고 Preview 갱신을 요구합니다. 모든 사전 검증 후 쓰며 저장소 실패는 메모리 fallback 안내를 표시합니다. 서버 트랜잭션이나 동시 탭 동기화까지 제공하는 것은 아닙니다.

### 코드 및 Security Audit (2026-09-17)

- 검사 범위: app/components/features/lib/types/data, `.env.example`, `.gitignore`, Reference 해시. 의존 패키지 취약점의 온라인 감사나 실제 API 보안 테스트는 수행하지 않았습니다.
- 실제 Access Token/API Key/Password/Secret/Client Secret/Service Account 값 발견 없음. 이름/설명/입력 검증 패턴만 존재하며 길고 실제처럼 보이는 가짜 토큰도 추가하지 않았습니다.
- `.env.example`의 7개 변수는 모두 빈 값. `.env*`는 제외하고 `.env.example`만 예외입니다. Secret용 입력 컨트롤과 `NEXT_PUBLIC` Secret이 없습니다.
- 앱 소스에 `fetch`, axios, OAuth, 외부 API 실행, `console.log`, 명시적 `any` 사용 없음. UI는 Repository를 직접 읽지 않습니다. 선택 목록용 Mock 설정 상수 import는 기존 구조를 유지합니다.
- CPA/ROAS·Simulation·Campaign Forecast는 기존 엔진을 재사용합니다. 신규 UI에는 표기/목록/상태 처리만 두고 Trend/Readiness/Insight/충돌/복원 계산은 서비스에 배치했습니다. 미사용 import를 정리했습니다.
- LocalStorage 접근은 기존 lib 저장 모듈로 한정됩니다. 인증·암호화 저장·서버 DB는 미구현이며 Mock 설정/집계만 저장합니다.
- HTML 입력값 escape와 CSP, CSV 수식 방어를 유지했습니다. Import 자격 증명 키와 프로토타입 오염 필드를 차단합니다.
- reference HTML 변경 없음. SHA256: `280954424FA392D46B7F93656ADC41141831EB92F25AD8FFB1EB0C4F5E087EDA`.

### 검증 및 다음 단계

`npm test`, `npm run typecheck`, `npm run build`, `npm run test:ui`로 검증합니다. 브라우저 테스트는 로컬 production 3100번과 Edge를 사용하며 외부 계정에 접근하지 않습니다. 최종 실행 결과: 단위 테스트 **37/37 통과**, Edge 브라우저 테스트 **20/20 통과**, TypeScript 오류 **0**, `npm run build` **성공**. 기존 Home/Funnel/Performance/Campaign/Operations 회귀와 신규 화면·설정·충돌·백업 복원을 포함합니다. 상세 준비 상태와 실제 연결 전 점검은 [MVP_READINESS.md](MVP_READINESS.md)에 정리했습니다.

다음은 사용자의 전체 프로그램 검수입니다. 이후 GA4 읽기 → Meta Dataset/Pixel 검증 → Meta Marketing 읽기 → 별도 승인된 제한적 쓰기 순서로 실연결을 준비하는 것을 권장합니다. ChatGPT Ads는 공식 이용 가능 범위를 먼저 확인해야 합니다. 이번 단계에서는 실제 API 테스트를 시작하지 않습니다.

## MVP 전체 검수 라운드

기존 기능을 유지하며 설정 저장의 조회 기간 초기화, favicon 404, 병목/집계 범위 설명, 작은 글씨, Forecast 빈 공간과 Reports 반응형 배치를 수정했습니다. 최종 단위 **40/40**, 브라우저 **24/24** 통과, TypeScript·미사용 선언 검사와 프로덕션 빌드 성공. [상세 검수 결과](MVP_AUDIT.md)를 참고하세요.


## GA4 Read Only 1단계

기본 Mock MVP를 유지하면서 서버 전용 GA4 Data API Connector를 추가했습니다. GA4 Real은 현재 로컬 개발 서버에서만 허용됩니다. 사용자 인증 없는 프로덕션 조회는 차단됩니다. Meta/ChatGPT Ads 및 광고비·CPA·ROAS는 계속 Mock입니다.

[GA4_REAL_TEST.md](GA4_REAL_TEST.md)에 설정, 서비스 계정 파일 보관, 광고주 Property 매핑, 지표 정의, 수동 연결 확인과 제한을 정리했습니다. 실제 Credential/API 연결은 수행하지 않았습니다. `npm run dev -- --hostname 127.0.0.1`로 실행하고 Connections에서 모드를 선택합니다.


## UX / 역할별 대시보드

관리자/광고주 Mock Role과 중앙 권한 정책을 추가했습니다. `npm run dev` 후 사이드바의 현재 보기로 검수할 수 있습니다. 광고주는 브랜드 A에 고정되며 캠페인은 읽기 전용입니다. 관리자 전용 광고주 관리(`/advertisers`)와 관리 설정(`/settings`) 메뉴를 추가했습니다. 실제 로그인이나 신뢰 가능한 서버 인증은 아직 없습니다.

[UX_PERMISSION.md](UX_PERMISSION.md)에 역할별 기능, Route/Action/Service 검사, Mock 권한의 한계와 교체 지점을 정리했습니다.

## Production Foundation 최종 상태

환경 분리, PostgreSQL 전용 스키마·migration, Transaction/idempotency, Rate Limit, 서버 검증, Auth/이메일 오류 처리, CSP/보안 헤더, Request ID/Logger, Health/Readiness, Dashboard 서버 요약을 추가했습니다. 기존 마케팅 계산과 Mock 기능은 유지합니다.


## 최종 자동 검증 결과

2026-09-17: Unit 55/55, Edge Browser 50/50 통과. TypeScript 오류 0, Lint 통과, `npm run build` 성공. 기존 Home/Funnel/Performance/Campaign/Operations/Reports/Connections 및 사용자·광고주 관리 회귀를 포함합니다. 신규 검증은 원자적 실패 롤백, idempotency/응답 유실 복구, 음수 예산·잘못된 입력, 요청 제한, 이메일 실패, 비활성 로그인, 최소 Health/Admin Readiness입니다. 실제 외부 API 호출 없이 로컬 테스트 메일 수신기를 사용했습니다.

실제 Staging 배포 준비사항과 미검증 외부 항목은 [DEPLOYMENT.md](DEPLOYMENT.md), [SECURITY_AUDIT.md](SECURITY_AUDIT.md), [STAGING_CHECKLIST.md](STAGING_CHECKLIST.md), [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)를 확인하세요.

## 로그인 / 인증 진입 UX

상단 브랜드·하단 로그인 구조, 전송/발송/오류 상태, 접근 제한·세션 만료 안내를 정리했습니다. 기존 인증 API·권한·DB와 업무 화면 디자인은 유지합니다. Unit 55/55, Browser 55/55, TypeScript·Lint·build 통과. 상세 범위는 [AUTH_UX.md](AUTH_UX.md)를 확인하세요.
