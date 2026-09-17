# IntentBridge Product Specification

## 1. 제품 한 줄 정의
IntentBridge는 여러 유입 매체에서 들어온 관심 고객을 자사몰 행동 데이터로 분석하고,
구매하지 않은 고객을 다른 광고 매체에서 재공략해 추가 구매까지 연결하는 Cross-media Growth OS입니다.

현재 대표 퍼널:
ChatGPT Organic / ChatGPT Ads → 자사몰 → GA4 분석 + Meta Pixel/CAPI 수집 → Meta Retargeting → Purchase

중요: GA4가 사용자 목록을 Meta로 보내는 구조가 아닙니다.
자사몰에서 GA4 분석과 Meta 이벤트 수집이 병렬로 작동합니다.

## 2. 확장 철학
GPT 전용 툴이 아닙니다.
Source A → Site Behavior → Non-Purchase Segment → Retarget Channel B 구조로 확장합니다.
예: GPT→Meta, Naver→Meta, Google→Meta, Content/Influencer→Meta 등.

## 3. 핵심 사용자 가치
- 새 유입을 단순 방문으로 끝내지 않음
- 미구매 고객을 행동 단계별로 다시 공략
- 직접 구매와 회수 구매를 통합 성과로 확인
- 반복적인 UTM / 분석 / Audience / 제외조건 / 리포트 작업을 한 곳에서 운영
- 성과 병목과 개선 시나리오를 Simulation

## 4. 주요 화면
### A. Home
첫 10초 안에 아래를 이해해야 함:
"관심 고객을 데려오고, 놓친 고객을 다른 매체에서 다시 잡아 구매를 늘리는 프로그램"

핵심 KPI:
- Source Unique Users
- Sessions
- Direct Purchase
- Non-Purchase Users
- Retargetable Audience
- Recovered Purchase
- Total Purchase
- Ad Spend
- Revenue
- CPA
- ROAS

### B. Funnel Workspace
- 광고주 선택
- 기간 선택
- Source별 유입
- GPT Organic / Ads 분리
- 확장 가능한 source enum
- ViewContent / AddToCart / BeginCheckout / Purchase
- 미구매 계산
- Meta Audience 후보
- Purchase 제외
- 세그먼트 우선순위
- 직접구매 / 회수구매 / 통합구매

### C. Performance Lab
- Current performance diagnostics
- Funnel bottleneck analysis
- Landing conversion simulation
- Retargeting conversion simulation
- Budget allocation simulation
- Conservative / Recommended / Aggressive scenarios
- Forecast purchase / revenue / CPA / ROAS
- Before vs After comparison
- Rule-based recommendations

### D. Campaign Automation
현재는 DEMO UI.
- Source identification rule
- Event rule
- Audience rule
- Retargeting window
- Purchase exclusion
- Reporting template

### E. Connection Center
최종 구현 전까지 Mock 상태만 표시.
- GA4 Connector
- Meta Connector
- Pixel/CAPI Connector
- ChatGPT Ads Connector

상태 예시:
- NOT CONNECTED
- READY FOR TEST
- MOCK CONNECTED

## 5. 광고주 데이터
광고주별 저장 항목:
- id
- name
- brandName
- productName
- landingUrl
- industry
- sourceCampaigns
- retargetingConfig
- budgets

광고주 변경 시 모든 대시보드 Mock 데이터가 변경되어야 합니다.

## 6. Data abstraction
UI에서 API를 직접 호출하지 않습니다.
Connector interface를 통해 받습니다.

권장 구조:
- SourceConnector
- AnalyticsConnector
- RetargetingConnector
- AdsConnector

초기 구현:
- MockSourceConnector
- MockAnalyticsConnector
- MockRetargetingConnector
- MockAdsConnector

최종 구현:
- GA4Connector
- MetaConnector
- ChatGPTAdsConnector

## 7. Privacy / Security
- 개인 Google/Facebook 비밀번호 저장 금지
- Secret / Access Token을 LocalStorage 저장 금지
- 실제 secret은 서버 환경변수 또는 Secret Manager 전제
- 개인 사용자 식별 목록을 UI에 노출하지 않음
- 집계 데이터와 세그먼트 규모 중심

## 8. UI 방향
- B2B SaaS
- Light background + dark workspace panels
- Mint / Violet accents
- 너무 많은 카드 금지
- 큰 KPI와 퍼널을 먼저
- 기술 ID/토큰은 홈에서 숨김
- 한국어 가독성 우선
- 불필요한 강제 줄바꿈 금지
- desktop 1440px 기준, 1366px에서도 깨지지 않게

## 9. 현재 개발 원칙
실제 API 연결은 제품 UI/기능 최종 구현 후 한 번에 테스트합니다.
그 전에는 모든 데이터가 Mock 또는 DEMO FORECAST입니다.
