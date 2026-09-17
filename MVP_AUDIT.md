# IntentBridge MVP 전체 검수 · 2026-09-17

범위: 기존 1~6차 기능의 사용자 Journey, 데이터 정합성, 표시·반응형, 저장 복원, 로컬 보안 검사. 대규모 기능 추가/구조 교체/외부 API 연결 없음.

## 발견 및 수정

| 문제 | 수정 |
| --- | --- |
| 기본 기간을 바꾸지 않고 Density만 저장해도 현재 조회 기간이 기본 기간으로 초기화됨 | 기본 기간 설정 자체가 변경된 경우에만 공통 조회 기간 갱신 |
| 첫 브라우저 방문에서 `/favicon.ico` 404 콘솔 오류 | 외부 리소스 없는 로컬 favicon 추가 |
| Funnel과 Performance의 병목/추천 선정 기준 차이가 불명확 | 선택 소스의 최저 전환율 vs 전체 소스의 Mock 목표 미달·시나리오 효율 기준 설명, Funnel에서 Performance로 연결 |
| Reports 상단 원천 실적과 Campaign 관측값이 같은 집계처럼 보일 수 있음 | 광고주 원천 스냅샷과 캠페인별 운영 관측 범위 명시, HTML Export에도 반영 |
| Reports/Connections footer가 ‘1차 프로토타입’으로 표시됨 | 공통 MVP · MOCK DATA 표시 |
| 다수 본문 보조 텍스트·표·버튼이 7~11px | 기존 스타일의 텍스트 크기를 12px 이상으로 조정. 로고 장식 문구는 예외 |
| Performance Forecast가 긴 슬라이더 영역 높이에 늘어나는 빈 공간 | Grid의 세로 정렬을 start로 변경 |
| Reports 단순 3열 표에도 670px 최소 폭이 강제됨 | 보고서 표의 불필요한 최소 폭 제거 |
| 768px Reports 5열 Funnel에서 숫자/단위가 줄바꿈됨 | 중간 폭에서 3열 배치, 숫자·단위 줄바꿈 방지 |
| 높이가 낮은 창에서 sidebar 하단 접근 제한 가능 | sidebar 자체 세로 스크롤 허용 |
| 미사용 타입/import 5개 | 삭제 후 noUnusedLocals/noUnusedParameters 검사 |

## Route별 결과

| Route | 목적·다음 Action·검수 |
| --- | --- |
| Overview | 원천 KPI → Funnel/Performance/캠페인 생성. A/B 및 기간 변경 확인 |
| Funnel | 소스별 전환/이탈 → 전체 개선 여지 비교 또는 선택 Segment 캠페인 생성. Audience 조건·빈 조합 복귀 확인 |
| Performance | Current/Forecast 비교 → 가정 적용·저장·추천 캠페인. 원본 Scenario/Forecast 및 추천 예산 전달 확인 |
| Campaign | Audience/Channel/Message/Budget/Forecast → 초안 저장·Mock 생성. 새로고침 복원과 Mock 활성화 확인 |
| Operations | 현재 상태·규칙/충돌/Guardrail → 명시적 적용·Rollback. 변경 이력·버전·Alert·Trend 확인 |
| Reports | 원천 KPI와 별도 캠페인 관측·최신 변경 요약 → HTML Export. 빈 캠페인 생성 CTA 확인 |
| Connections | Mock 연결 준비·상세 → 설정·Backup/Import. Credential 입력 없음, 지원하지 않는 상태의 Empty 표시 확인 |

전체 Journey를 브랜드 B/14일로 순서대로 이동하고 추천 기반 초안 저장/새로고침/생성/활성화/운영 Pause/Reports 갱신/Connections 이동을 검증합니다. 기존 회귀 테스트가 Segment·Audience·Window·소스·시나리오·Library·Export·충돌·Merge/Replace·잘못된 데이터 차단 등을 함께 검증합니다. 검수한 활성 Action에서 무반응·깨진 링크·빈 Modal은 발견하지 않았습니다. 미지원 채널의 비활성 생성 버튼은 의도된 제한입니다.

## 숫자와 의도적으로 유지한 차이

- A/B × 7/14/30일에서 Purchase/Revenue/Spend/CPA/ROAS/Audience/Recovered Purchase는 같은 집계 개념끼리 일치합니다.
- Funnel 소스 필터는 해당 화면 범위입니다. Performance는 전체 소스를 분석합니다. Funnel의 최저 전환율과 Performance의 목표 미달 비율·재공략 진단은 서로 다른 기준이므로 계산 순위를 강제로 맞추지 않았습니다.
- 직접 퍼널 각 단계의 전환율은 두 화면에서 동일합니다. Performance는 재공략 풀의 진단도 포함합니다.
- Recommendation → Campaign의 광고주, Segment, Audience, Window, 채널, 예산 산식, 원본 Scenario/Forecast를 테스트합니다. 전체 퍼널 Simulation과 개별 Campaign Forecast를 합치지 않았습니다.
- Window·예산·Status 변경 후 Operations와 Reports의 저장 캠페인/이력은 최신 값으로 일치합니다. 광고주 원천 KPI는 과거 Mock 스냅샷으로 유지됩니다.
- MOCK DATA는 원천/합성 관측, DEMO FORECAST는 가정 계산, MOCK AUTOMATION은 로컬 운영 변경, MOCK CONNECTED는 연결 전 Mock Adapter 상태를 의미합니다.

## 저장·빈 상태·검수 한계

- 광고주/기간은 Route 이동 중 Context로 유지됩니다. Campaign/Operations는 URL에서 새로고침 복원합니다. 그 외 Route의 직접 새로고침은 기존 명세대로 브랜드 A와 기본 기간으로 시작합니다. 전역 선택 자체를 새 저장 대상으로 추가하지 않았습니다.
- Simulation은 광고주·기간별 저장, Campaign 초안/Rule/Settings는 기존 로컬 저장 대상으로 복원됩니다. 저장 차단 시 메모리 fallback을 유지합니다.
- 캠페인/초안/Library가 비어 있을 때 안내와 생성 동선을 확인했습니다. Funnel 미지원 조합 및 Connections 빈 상태 필터도 확인했습니다. 등록 광고주 자체가 0개인 설정은 현 고정 Mock 카탈로그에서 제공하지 않습니다.
- 세부 운영/소스 테이블의 내부 가로 스크롤은 비교 가능한 열을 보존하기 위해 유지합니다. 단순 Executive 표의 불필요한 스크롤만 제거했습니다.
- 문구·간격·폰트와 명확한 오류만 수정했습니다. 모든 카드를 다시 디자인하거나 Forecast/저장 구조를 교체하지 않았습니다.

## 검증

- 단위 테스트: `npm test` — 40개. 신규 Journey 정합성·전달·보고서 갱신 3개 포함.
- 브라우저: `npm run test:ui` — 24개. 7개 Route × 1366/1024/768px, 기존 모바일 검사 및 전체 Journey 포함.
- 각 요청 폭에서 문서 전체 가로 넘침 없음. 스크린샷으로 Performance/Reports/Overview의 배치와 글자 크기를 추가 확인.
- Journey/Route 브라우저 검사에서 JavaScript 오류, React/Hydration warning, 앱 콘솔 오류 및 외부 요청을 검사.
- `npm run typecheck`, `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`, `npm run build` 실행.

## Security 재검사

앱 소스(app/components/features/lib/types/data)의 실제 Credential 할당 패턴, 외부 요청, console.log/error, 명시적 any를 검사했습니다. 실제 값/외부 호출 발견 없음. `.env.example`은 7개 모두 빈 값이며 `.env*` 제외 규칙을 유지합니다. LocalStorage 접근은 기존 lib 저장 계층으로 제한되고 개인 계정 로그인·OAuth·외부 API 테스트는 실행하지 않았습니다. 패키지 온라인 취약점 검사나 실제 인증 보안 검증까지 수행한 것은 아닙니다.

reference HTML SHA256은 `280954424FA392D46B7F93656ADC41141831EB92F25AD8FFB1EB0C4F5E087EDA`로 변경 없음.

최종 결과: 단위 **40/40 통과**, 브라우저 **24/24 통과**, TypeScript 및 미사용 선언 검사 **오류 0**, `npm run build` **성공**. 검수한 Journey/Route에서 앱 콘솔 오류·React/Hydration 경고·외부 요청 없음.
