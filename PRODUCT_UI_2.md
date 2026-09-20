# IntentBridge Product UI 2.0

## 범위

프레젠테이션 계층만 변경했습니다. Auth.js, Credentials, 회원가입/Hash, 역할/Permission, Membership, Tenant Isolation, 서버 Authorization, Prisma, API, Audit 생성, 저장 및 계산 엔진은 변경하지 않습니다. 새 패키지/외부 API/차트 의존성을 추가하지 않습니다.

## 공통 디자인

- `app/product-ui.css`: 인증 화면에 영향을 주지 않는 `.app-shell` 범위. Navy navigation, warm gray 배경, 4–6px radius, border 기반 surface.
- Mint: 실행과 정상 상태. Violet: 예상 성과. Amber: 확인 필요. Red: 조치 필요.
- `components/product-ui.tsx`: KpiMetric, SectionHeader, ActionQueue, StatusBadge, DataTable, Money, InsightBanner, DataSourceBadge, EmptyState, WorkspaceSkeleton, TrendChart, ForecastComparison.
- 금액 요약: 만/억 단위. Money의 title에서 원 단위 확인. 상세 입력/기존 내보내기는 기존 전체 숫자를 유지합니다.
- TrendChart: 기존 일별 수치를 그대로 사용한 SVG. 포인터, 좌우 방향키/Home/End, 읽기용 표 지원. 외부 라이브러리 없음.

## 화면 구성

- SUPER_ADMIN / MANAGER: 공통 Dashboard + 기존 허용 범위의 요약. KPI → 우선 액션 → Performance Table → 선택 광고주 추이 / 최근 변경.
- SUPER_ADMIN 최근 활동은 기존 `/api/admin/audit` 읽기. MANAGER에게 Audit API 권한을 확대하지 않고 담당 광고주의 기존 lastUpdated를 표시합니다.
- MANAGER의 내 광고주는 기존 Dashboard의 담당 목록으로 이동합니다. 기존 Connections 조회 권한도 유지합니다.
- ADVERTISER: KPI → 한 줄 Insight → 고객 흐름/재방문 구매 → 개선 전망 → 광고 상태 → 구매 추이. 상세 레버/쓰기 액션은 추가하지 않습니다.
- Journey: 넓은 화면의 가로 단계, 좁은 화면의 세로 단계. 회수 구매는 별도 Branch로 유지하며 현재 미구매 풀과 기간 내 회수 구매의 시점 차이를 보존합니다.
- Performance: 현재/예상 비교, 시나리오, 접힌 상세 조정. 계산값과 자동 저장 동작은 동일합니다.
- Campaign: 요약/목록을 편집기보다 먼저 배치. 상세 모달은 Overview, Audience/Budget, Creative, Forecast, History로 그룹화합니다.
- Operations: 대기 액션 수와 Queue 중심. 기존 검토/Mock 적용/무시/롤백 유지.
- Reports: 보고서형 surface, 성과 요약, 고객 흐름, 성과 개선, 캠페인 및 운영 현황, 인사이트. 기존 HTML 내보내기 엔진 유지.

## 데이터 정직성

전기 대비 실적이 제공되지 않아 증감률은 만들지 않습니다. Dashboard의 Mock 추이는 기간 합계를 배분한 예시임을 표시합니다. GA4 실측/Mock 광고/Forecast 표시는 기존 Data Provenance 흐름을 유지합니다. 인위적인 +12% 같은 장식 지표는 없습니다.

## 검증

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:ui`.

브라우저 테스트는 1440/1366/1024/768/390px에서 세 역할의 Dashboard, ADVERTISER 모바일 Reports, 차트 키보드 탐색 및 상세 조정을 확인합니다. 기존 인증/권한/IDOR/세션/저장/계산 회귀도 유지합니다. UI 문구 및 접이식 조작에 맞게 해당 표시 테스트만 조정합니다.

### 검증 결과 (2026-09-20)

- 단위 테스트: 64/64 통과.
- TypeScript, ESLint, Next.js production build 통과.
- 브라우저 전체 62개 항목 중 최종 전체 실행 60개 통과. 이전 실패 실행이 남긴 테스트 전용 임시 광고주 때문에 백업/목록의 2개 fixture 개수 검사가 실패했고, 해당 행만 정리한 뒤 관련 백업·권한·보안 19개를 재실행해 모두 통과했습니다. 앱/운영 DB에는 정리 작업을 수행하지 않았습니다.
- SUPER_ADMIN/MANAGER/ADVERTISER Dashboard의 1440, 1366, 1024, 768, 390px 및 ADVERTISER 모바일 Report 캡처·차트 키보드 검사 통과.
- 화면 예시: `.validation/product-ui/` (로컬 검수용, Git 제외).
