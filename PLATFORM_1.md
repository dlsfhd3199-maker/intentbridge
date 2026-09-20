# IntentBridge Platform 1.0

## 업무 흐름

광고주 생성 후 Connections의 온보딩으로 이동한다. 프로필(URL·월 예산·목표)을 저장하고, 기존 사용자 관리에서 ACTIVE MANAGER를 배정한다. GA4 데모 연결 → 데이터 확인 → 운영 시작 순서로 진행한다. 대시보드의 기존 데이터가 없는 워크스페이스는 KPI 대신 설정 안내를 표시한다. 기존 운영 데이터가 있는 워크스페이스는 초기 설정 문서가 없어도 기존 화면을 이용할 수 있다.

상단 업무 흐름 링크, 검색 및 빠른 전환은 접근 가능한 광고주와 기존 권한을 따른다. Funnel 세그먼트와 Performance 추천은 기존 Campaign Handoff를 통해 초안에 전달된다. 캠페인의 목표·고객 그룹·채널·메시지·예산·예상 성과·검토 흐름과 기존 저장/운영/보고 기능을 유지한다.

## 저장 및 권한

- Prisma 모델과 migration 변경 없음.
- `WorkspaceDocument`의 `intentbridge:platform:v1:<advertiserId>` 문서에 프로필, 데모 연결, 검증/운영 시작 여부, 최근 설정 활동을 저장한다.
- `/api/workspaces/[advertiserId]/platform` GET은 기존 광고주 접근 검사를 사용한다. PATCH는 기존 `MANAGE_CONNECTIONS` 권한(SUPER_ADMIN), 동일 출처 검사, 입력 검증, revision 충돌 검사, Serializable transaction, 요청 식별/멱등 처리와 Audit 기록을 사용한다.
- MANAGER는 배정된 광고주의 설정을 조회한다. ADVERTISER에게 연결 메뉴/쓰기 버튼을 제공하지 않는다. 기존 인증·세션·역할·Membership·Tenant Isolation 정책은 변경하지 않는다.
- 연결 시 새 광고주의 데이터가 비어 있을 때만 기존 데모 fixture를 결정적으로 선택해 `Advertiser.mockData`에 넣는다. 기존 실적이 있으면 덮어쓰지 않는다. 새로고침은 수집 시간/활동을 갱신하고 검증 상태를 해제한다.
- 최초 관리자 생성/사용자 승인 방식, GA4 Real 준비 구조, 외부 Secret과 배포 설정은 변경하지 않는다.

## Connector와 데이터의 의미

`UI → ConnectionService → PlatformConnector(AnalyticsConnector / AdsConnector) → Demo Adapter`를 사용한다. Service에 동일 인터페이스의 다른 adapter를 주입할 수 있다. 이번 registry에는 데모 adapter만 등록한다. 기존 Real GA4 Connector는 별도 Advanced 설정과 기존 화면 경로로 보존한다. OAuth, 광고 API 또는 실제 광고계정 요청을 추가하지 않는다.

7개 연결 카드와 6단계 Wizard: GA4, Naver, Meta, Google, Kakao, Daangn, ChatGPT/AI Traffic. 연결 상태, 수집 항목, 계정/Property 선택, 테스트, 최근 동기화, 데이터 확인과 Demo Mapping을 제공한다.

현재 실제 데모 실적은 기존 GPT → Meta fixture를 사용한다. GA4 구매 = 직접 구매 + Meta 재방문 구매이며 매출도 같은 기준이다. Naver/Google/Kakao/Daangn은 연결 UX 데모이고 기존 fixture에 해당 매체 실적이 없음을 명시한다. 임의의 매체 매출을 더해 Dashboard 합계를 부풀리지 않는다. Campaign의 다른 채널은 초안에서 선택할 수 있으나 기존 지원 범위를 유지한다. 예상 성과/데모 생성은 GPT → Meta이며, ChatGPT Ads는 Experimental / Planned다.

`loadPerformanceTrend`는 30일 공통 일별 시계열을 만들고 7일/14일은 정확한 suffix로 제공한다. 기존 기간별 엔진 합계를 보존하며 광고주·기간을 다시 조회해도 값이 변하지 않는다. Campaign 운영 관측과 전체 광고주 원천 실적은 서로 다른 집계 범위이며 기존 구분을 유지한다.

보고서 기간(이번 달/지난달/7일/30일)은 고정 데모 기준일 `2026-09-17`을 따른다. 월 전체 데이터가 없으면 제공 일자만 집계한다고 표시한다. 기본 HTML 및 관리자/마케터 Advanced CSV/JSON을 제공하고 기존 Executive Export도 보존한다. Real GA4 보고서에는 데모 기간 다운로드를 삽입하지 않는다.

## 알림·활동·표시 설정

- Bell: 기존 Operations 요약과 선택 광고주의 연결/설정 활동. 외부 알림 발송 없음. 읽음 상태와 최근 광고주는 사용자별 브라우저 sessionStorage에 저장한다.
- 광고주 상세 최근 활동: 기존 Campaign/Draft/Simulation/OperationHistory의 저장 시각과 플랫폼 설정 활동을 합쳐 표시한다. 생성 시각으로 오인하지 않도록 저장 활동으로 표시한다.
- 회사명·텍스트 로고·기본 기간/통화/Timezone는 기존 관리자 UserSetting을 재사용한다. 현재 관리자 계정의 표시 설정이며 전사 공유 설정이 아니다. 통화 KRW, Locale ko-KR, Timezone Asia/Seoul만 지원한다. 민감 설정을 저장하지 않는다.

## 검증 및 Git 정책

기본 검사: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
브라우저: `npm run test:ui` (격리된 SQLite 테스트 DB와 로컬 3100/3101 서버). 새 테스트는 온보딩, 실제 Membership 필요 조건, Wizard, deterministic refresh, revision/CSRF/계정 검증, 역할별 API 격리, 검색/전환/읽음, 보고서와 1440/1366/1024/768/390px 화면을 확인한다. 기존 보안·GA4 fixture·Campaign/Performance/Funnel handoff 회귀를 유지한다.

신규 API 쓰기와 빈 워크스페이스의 데모 데이터 저장이 있으므로 AGENTS.md 기준 HIGH다. 코드 검증 후 명시적 검토 승인 전에는 commit/push 및 Cloudtype 배포를 진행하지 않는다. 운영 DB에는 migration/seed/reset을 실행하지 않는다.

검증 결과 (2026-09-20): TypeScript, Lint, production build 성공. 단위 테스트 68/68, 전체 브라우저 회귀 67/67 통과. 마지막 일별 매출 배분 조정 후 관련 Platform/MVP 브라우저 9/9 재검증 통과. 5개 viewport에서 가로 넘침 및 역할별 화면을 확인했다. 운영 PostgreSQL/Cloudtype나 실제 광고 API를 대상으로 테스트하지 않았다. 변경 파일의 Secret 패턴 검사 후보 0건, diff whitespace 검사 통과. CI 분류 결과 HIGH, migration=false. Commit/push/배포는 수행하지 않았다.
