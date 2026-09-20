# IntentBridge Design System 3.0

Editorial Data Workspace: 고객 흐름 → 신호 → 판단 → 행동을 화면의 중심으로 삼는다.
Presentation 범위만 변경하며 기존 데이터 집계, API, 권한과 저장 흐름을 재사용한다.

## 의미와 토큰

앱 토큰은 `app/product-ui.css`의 `.app-shell`에 한정한다. 인증 화면은 적용 범위 밖이다.
공개 홈페이지는 `features/public/public.css`의 `.pw-site`에 별도 한정하며 인증 데이터에 접근하지 않는다.

| 토큰 | 역할 | 값 |
| --- | --- | --- |
| surface | Warm White 기본 배경 | #faf9f5 |
| surface-muted | 보조 정보와 hover | #f0f0eb |
| ink | Navy 제목·데이터·기준선 | #172c43 |
| ink-muted | 설명·날짜·보조 라벨 | #596675 |
| line | 영역·행·단계 사이 구분 | #d6d9d7 |
| action | 행동·회수 기회 | #276c59 |
| forecast | 예상값·시뮬레이션 | #6b4d9c |
| danger | 하락·오류 | #a64036 |
| warning | 점검할 이탈·주의 | #845820 |

간격: 4 / 8 / 12 / 16 / 24 / 32 / 48px. 기본 버튼·입력 radius: 3px.
본문 14px, 보조 라벨 12px, 일반 제목 21–24px. 중요한 흐름의 수치에만 30px 이상을 사용한다.
공개 사이트 본문은 16px. 숫자는 tabular figures와 한국어 단위를 사용한다.

## 표현 원칙

- Dashboard: 현재 접근 가능한 광고주 집계, 우선순위 피드, 최우선 Journey Signal, 기간 Data Strip.
- Journey: 순차 단계별 이탈선과 별도 Recovery Branch. 현재 재공략 인원과 기간 내 회수 구매를 혼동하거나 회수 전환율을 생성하지 않는다.
- SignalIndicator: DROP(하락), OPPORTUNITY(개선 기회), RECOVERY(회수), DATA(데이터), CAMPAIGN(캠페인). 데이터로 입증되는 유형만 표시한다. 전기 자료 없이 하락·증가율을 만들지 않는다.
- Activity: 기존 서버 Audit 또는 담당 광고주 최근 편집만 사용한다. 기록이 없으면 텍스트 빈 상태를 표시한다.
- Forecast: 현재 → 예상의 한 축으로 표현하고 예상 영역에 Violet을 사용한다.
- Campaign: 기존 편집 폼·검토·저장을 유지하며 오른쪽에 현재 초안의 고객/기간/예산/메시지를 표시한다.
- Connections: 같은 크기의 연결 카드 대신 상태·동기화·액션을 행으로 표시한다.
- Reports: 요약 판단, 성과, 고객 흐름, 운영, 다음 확인 항목. 인쇄에서는 내비게이션과 도구를 제외한다.
- 카드/그림자/배지 대신 divider, 행, 선과 타이포그래피를 사용한다. 공개 Hero 제품 미리보기에만 약한 그림자를 허용한다.

## 반응형 및 검증

콘텐츠 최대 폭은 앱 1450px, 공개 사이트 1320px. Activity Rail은 1024px 이하에서 하단으로 이동한다.
모바일 Dashboard는 우선순위 신호 → Journey/행동 → 요약 → 상세/활동 순서다.
1920, 1440, 1366, 1024, 768, 390px 스크린샷은 기존 Playwright 테스트가 생성한다.
세 역할 Dashboard, 고객 여정, 성과 개선, 캠페인, 연결, 보고서, Public Home을 대상으로 가로 넘침을 검사한다.
차트 키보드 탐색, 공개 페이지 대비, CTA, 기존 전체 기능·보안 테스트를 유지한다.
