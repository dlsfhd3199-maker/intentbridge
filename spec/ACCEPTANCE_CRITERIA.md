# Acceptance Criteria

## 공통
- npm run build 성공
- TypeScript 오류 없음
- 콘솔 치명적 오류 없음
- 1366 / 1440 / 1920 desktop 폭에서 레이아웃 깨짐 없음
- 모바일은 최소한 핵심 정보 접근 가능
- HTML 단일 파일 방식 금지
- UI와 data/service layer 분리

## 홈
- 광고주 선택 가능
- 기간 변경 가능
- 핵심 KPI 8개 이하로 첫 화면 구성
- Funnel 요약 표시
- Direct vs Recovered Purchase 분리

## Funnel Workspace
- Source별 유입 표시
- 미구매 = 유입 사용자 - 구매자 단순 계산으로만 고정하지 말고 Mock 이벤트 데이터 기준 집계 구조
- Retargetable audience 표시
- Purchase exclusion 표시
- 세그먼트별 volume / priority 표시

## Performance Lab
- slider/input을 변경하면 forecast 값이 변경
- 시나리오 3종 동작
- 현재 vs forecast 비교
- "DEMO FORECAST" 명시
- 성과 보장 표현 금지

## 코드 구조
- components/
- features/
- lib/connectors/
- lib/simulation/
- data/mock/
- types/
구조 권장

## API 준비
- connector interface 존재
- mock connector가 UI 데이터를 공급
- 실제 secret이 프론트 코드에 포함되지 않음
