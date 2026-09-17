# IntentBridge - Codex Start Here

이 폴더는 IntentBridge 실제 SaaS 개발을 시작하기 위한 기준 패키지입니다.

## 가장 먼저 할 일
Codex에서 이 폴더 전체를 프로젝트로 열고 아래 첫 프롬프트만 입력합니다.

### 1차 프롬프트
```text
이 폴더는 IntentBridge 실제 SaaS 개발 프로젝트입니다.
먼저 spec/PRODUCT_SPEC.md, spec/ACCEPTANCE_CRITERIA.md, mock/mock-data.json,
reference/IntentBridge_Product_Showcase_Latest.html 을 모두 읽고 분석하세요.

중요:
- reference HTML은 기능과 디자인 참고용입니다. 기존 HTML에 코드를 계속 덧붙이지 마세요.
- 실제 제품은 새 Next.js + TypeScript + Tailwind CSS 구조로 재구축하세요.
- 지금은 실제 GA4 / Meta / ChatGPT Ads API 연결을 하지 않습니다.
- Mock 데이터와 Connector Interface만 먼저 만드세요.
- 비개발자가 Windows에서 쉽게 실행할 수 있어야 합니다.

이번 작업에서는 아래까지만 진행하세요.
1. 새 Next.js 프로젝트 구조 생성
2. 공통 레이아웃 / 사이드바 / 광고주 선택 UI
3. 홈 Dashboard 1차 구현
4. Workspace 2개 진입 구조 생성
   - Funnel Workspace
   - Performance Lab
5. Mock 데이터 연결
6. npm run build 성공 여부 확인
7. 변경한 파일과 실행 방법을 쉬운 말로 요약

실제 외부 API 인증이나 토큰 입력은 하지 마세요.
```

## 2차 프롬프트
1차가 정상 실행된 뒤 사용합니다.

```text
현재 IntentBridge 프로젝트를 이어서 개발하세요.
이번 작업은 Funnel Workspace 완성입니다.

PRODUCT_SPEC의 Funnel Workspace 요구사항을 기준으로 아래를 구현하세요.
- GPT Organic / GPT Ads 유입
- 기타 유입 채널 확장 가능한 Source 구조
- Unique / Sessions / ViewContent / AddToCart / BeginCheckout / Purchase
- 미구매 고객 계산
- Meta Retargetable Audience
- Purchase 제외
- 세그먼트 30D / 14D / 7D
- Direct Purchase + Recovered Purchase + Total Purchase
- 광고비 / 매출 / CPA / ROAS
- 기간 필터
- 광고주별 Mock 데이터 전환

UI는 reference HTML의 브랜드 아이덴티티를 참고하되 실제 SaaS 관리화면처럼 단순하고 명확하게 만드세요.
npm run build까지 검증하세요.
```

## 3차 프롬프트
```text
현재 프로젝트를 이어서 Performance Lab을 완성하세요.

목표는 단순 대시보드가 아니라 성과개선 시뮬레이션 시스템입니다.
- 현재 성과 진단
- 퍼널 병목 자동 탐지
- Landing CVR / Retargeting CVR / 예산 배분 시뮬레이터
- 보수적 / 추천 / 공격적 Scenario
- 예상 구매 / 매출 / CPA / ROAS 변화
- 개선 전/후 비교
- AI 운영추천 영역

현재는 규칙 기반 DEMO Forecast로 구현하고 실제 성과 예측 AI라고 표현하지 마세요.
모든 예상값에는 DEMO FORECAST 또는 Simulation 표시를 넣으세요.
npm run build까지 검증하세요.
```

## 마지막 API 연동 단계
UI와 기능이 모두 완성된 뒤에만 진행합니다.
- GA4 Data API
- Meta Marketing API
- Meta Pixel / CAPI
- ChatGPT Ads 연결 가능한 공식 범위

중간 개발 단계에서는 실제 API 연결을 요구하지 않습니다.
