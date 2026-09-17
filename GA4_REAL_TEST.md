# GA4 Read Only · 실제 연결 전 수동 검증

코드와 Fixture 검증은 완료했지만 실제 GA4 Credential/Property로 검증하지 않았습니다. GA4 Property ID와 Service Account 설정이 필요합니다. Credential을 채팅, 소스, 브라우저 입력란에 넣지 마세요.

## 준비와 실행

1. 사용자가 관리하는 Google Cloud 프로젝트에서 Analytics Data API를 활성화합니다. Service Account를 만들고 해당 이메일을 **GA4 Property의 Viewer**로 추가합니다. [공식 시작 안내](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart)를 따르세요.
2. Service Account JSON 키는 저장소 밖의 접근 제한된 폴더에 보관합니다. 서버 계정만 읽을 수 있도록 파일 ACL을 설정합니다. 키를 프로젝트 안에 복사하거나 Git에 추가하지 않습니다.
3. `.env.example`을 참고해 Git에서 제외되는 `.env.local`에 `GOOGLE_APPLICATION_CREDENTIALS`의 **절대 파일 경로**, `GA4_PROPERTY_ID`의 숫자 Property ID를 설정합니다. 파일 경로에는 `/` 구분자를 사용할 수 있습니다. JSON 문자열 인증은 지원하지 않습니다. `NEXT_PUBLIC_*`를 사용하지 않습니다.
4. 단일 `GA4_PROPERTY_ID`는 `brand-a`에만 적용됩니다. 여러 광고주는 `GA4_PROPERTY_MAP`에 광고주 ID → 숫자 Property ID 문자열의 JSON 객체를 설정합니다. Map을 설정하면 단일 ID보다 우선하며 미등록 광고주는 미설정 상태로 남습니다. 다른 광고주의 Property를 대신 사용하지 않습니다.
5. 기본 `GA4_DATA_MODE`는 `mock`입니다. 필요할 때 `real`로 설정하거나 Connections → Google Analytics 4 → GA4 Data Mode에서 전환합니다. UI 선택은 광고주별 현재 세션에만 적용되며 새로고침하면 서버 기본값으로 돌아갑니다.
6. `npm run dev -- --hostname 127.0.0.1`로 시작하고 표시된 로컬 주소로 접속합니다. 환경 설정 변경 후 서버를 재시작합니다. **현재 인증 없는 MVP는 production 및 비로컬 Real 요청을 거부합니다.** 배포하려면 사용자 인증·광고주별 접근 권한을 먼저 구현해야 합니다. `npm run build` 성공은 실제 연결 성공을 뜻하지 않습니다.
7. Connections에서 Property ID를 확인한 뒤 **연결 테스트**를 실행합니다. 어제 하루의 `totalUsers`만 읽습니다. CONNECTED, Last Tested, quota를 확인합니다. API 활성화/Property Viewer 권한/키 상태를 확인할 때 Credential을 화면이나 오류 로그에 복사하지 않습니다.
8. **최근 30일 검증 / Source Inspector**를 실행합니다. 네 가지 KPI, 이벤트 FOUND/NOT FOUND, 최근 30일 Sessions 기준 상위 20개 Source/Medium을 확인합니다. GPT 유입이 없다면 가짜 데이터를 만들지 말고 GA4 실제 source와 UTM을 확인합니다.
9. Overview/Funnel/Performance/Report의 광고주와 7/14/30일을 바꾸고, 동일한 Property·기간·통화의 GA4 보고서와 비교합니다. 오늘은 제외하며 종료일은 `yesterday`, 시작일은 `7daysAgo`/`14daysAgo`/`30daysAgo`입니다. GA4 Property timezone을 따릅니다. [공식 DateRange](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange)
10. 권한 오류/잘못된 설정 시 오류가 나타나고 명시적으로 Mock 복귀해야 하는지 확인합니다. Network Response·브라우저 Storage·클라이언트 번들·내보낸 HTML에 키, 이메일, 원본 SDK 오류가 없는지 확인합니다. 마지막으로 Mock 모드에서 기존 Campaign/Operations 흐름을 재확인합니다.

## 요청 계약과 수치 해석

| 보고서 | Dimension | Metric |
| --- | --- | --- |
| Overview | 없음 | totalUsers, sessions, ecommercePurchases, purchaseRevenue |
| Funnel 이벤트 | eventName | totalUsers |
| Traffic Sources | sessionSource, sessionMedium, sessionSourceMedium | Overview와 동일 |
| Daily | date | Overview와 동일 |
| Connection Test | 없음 | totalUsers |

이벤트 매핑은 `lib/ga4/definitions.ts`의 `defaultEventMapping`에서 view_item / add_to_cart / begin_checkout / purchase로 정의합니다. `GA4ServerConfig.events` 계약으로 교체할 수 있습니다. 실제 배포의 커스텀 이벤트는 이 매핑을 수정하고 테스트해야 합니다. [공식 Dimension/Metric 스키마](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)

- 이벤트별 totalUsers는 **순차 코호트가 아닙니다**. 미구매자·단계 이탈·재공략 Audience를 차감으로 추정하지 않습니다. 구매 KPI는 사용자 수가 아니라 ecommercePurchases입니다. 날짜별/Source별 Users도 합산해 기간 Unique로 사용하지 않습니다.
- Revenue는 purchaseRevenue 및 GA4 응답 currencyCode를 사용합니다. 환불로 음수인 값도 보존합니다. 앱의 Mock 통화 설정으로 환산하지 않습니다. 수집된 구매가 있지만 매출 0이면 REVENUE NOT DETECTED를 표시합니다. 이벤트 부재는 설치 실패를 단정하지 않습니다.
- GPT Source는 대소문자/공백 정규화 후 **정확한 alias 일치**로 분류합니다. 기본 alias는 chatgpt, chatgpt.com, chat.openai.com, openai입니다. `CHATGPT_SOURCE_ALIASES`, `CHATGPT_PAID_MEDIUMS`, `CHATGPT_ORGANIC_MEDIUMS`의 쉼표 목록으로 교체할 수 있으며 빈 값은 기본값입니다. 미등록 medium은 GPT Unclassified로 남습니다. Paid 분류는 UTM 관측이며 광고 플랫폼 인증/집행 증거가 아닙니다.
- Real Performance는 실측 KPI를 Baseline으로 구매율의 상대 변화 가정만 비교합니다. Reset은 실측으로 돌아갑니다. 비순차 집계를 기존 Mock 순차 퍼널 엔진에 넣지 않으며 광고비·회수 구매 레버는 실측 근거가 없어 제공하지 않습니다. 기존 Mock Performance의 전체 레버·Library는 Mock 모드에서 유지됩니다.
- Campaign/Operations 및 해당 Trend는 계속 MOCK AD DATA입니다. Real Daily 표는 **전역 기간**, 기존 Mock Trend는 자체 기간 선택을 사용합니다. Report의 GA4 Real / Meta Mock / Forecast Demo는 합산하지 않습니다. 실제 Spend/CPA/ROAS는 연결되지 않았습니다.

## 서버 구조와 보호

`UI → browser-service → /api/ga4 → server-only factory → GA4Connector → 공식 BetaAnalyticsDataClient.runReport`

SDK와 파일 읽기는 서버 전용 모듈에만 있습니다. JSON에서 client_email/private_key만 SDK에 전달하고 인증 scope는 `analytics.readonly`로 제한합니다. Admin/쓰기/OAuth/Meta/ChatGPT Ads API는 호출하지 않습니다. Mock 요청은 Google SDK 클라이언트를 생성하거나 키 파일을 읽지 않습니다.

요청별 10초 timeout, 일시적 429/500/503 최대 2회 추가 재시도, SDK 자체 중복 retry 비활성화, Property/광고주/기간/보고서별 메모리 캐시 60초와 진행 중 요청 병합을 사용합니다. 실패 캐시는 3초입니다. Connection Test도 캐시 기간에는 결과를 재사용할 수 있습니다. 재시작/환경 변경으로 캐시가 초기화되며 영속 데이터 저장소가 아닙니다. `returnPropertyQuota: true`를 요청합니다.

Missing Configuration / Invalid Property / Permission / Authentication / Quota / Rate Limit / Timeout / API Error를 안전한 문구로 표시합니다. 서버 SDK 오류 원문·stack·키 경로·Credential은 응답하지 않습니다. 같은 출처 요청만 허용하며 응답은 no-store입니다. 프로덕션 인증·서버 Secret Manager·독립 보안 검토는 후속 과제입니다.

## 자동 검증

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:ui`, `npm audit --audit-level=low`.

Unit은 주입한 Fake runReport만 사용합니다. Browser는 GA4 Fixture 응답을 가로채며 테스트 서버 환경에서 Property/키 경로를 비웁니다. 실제 Google 계정/키/API 호출은 수행하지 않습니다. 보안 검수는 서버 경계·오류 제거·생성된 클라이언트 번들 및 무자격 증명 응답을 검증한 범위이며 실제 Credential이 있는 운영 환경의 검증을 대신하지 않습니다.

2026-09-17 검증 결과: TypeScript/Lint 성공, Unit 49/49, Browser 28/28, production build 성공, npm audit 취약점 0건. 생성된 클라이언트 청크에서 BetaAnalyticsDataClient/google-auth-library/private_key/node:fs를 발견하지 않았습니다. Reference HTML SHA256은 변경 전과 동일합니다. 실제 GA4 연결 검증은 미실행입니다.
