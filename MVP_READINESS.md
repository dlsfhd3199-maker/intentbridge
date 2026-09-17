> GA4 Read Only 1단계 추가: 로컬 Real 조회 코드 구현, 실제 연결 미검증. 상세 실행·보안·지표 제한은 [GA4_REAL_TEST.md](GA4_REAL_TEST.md)를 확인하세요. 아래 Mock 기능 평가를 유지합니다.

# IntentBridge MVP Readiness · 2026-09-17

평가 범위는 **외부 API를 연결하지 않은 로컬 Mock MVP**입니다. READY는 해당 Mock 기능의 검수 준비를 뜻하며 실제 광고 운영이나 상용 서비스 출시 준비 완료를 뜻하지 않습니다.

| 영역 | 상태 | 근거와 남은 일 |
| --- | --- | --- |
| Product UI | READY | 7개 Route, 전역 광고주/기간, 설정·밀도, 공통 상태 UI. 사용자의 전체 흐름 최종 검수 필요 |
| Funnel | READY | 기존 이벤트 코호트·소스·세그먼트·Audience·Preview 유지, 집계 회귀 테스트 |
| Simulation | READY | 기존 공통 엔진·레버·시나리오·Library 재사용, 경계값 테스트 |
| Campaign | READY | Draft/READY/Mock Active, 설계·Forecast·비교·버전·Export 유지 |
| Operations | READY | Rule P1–P5, 충돌·유사 중복, Guardrail, 명시적 Mock 적용·복원, 일자별 합성 추이 |
| Report | READY | KPI 6개, Funnel 요약, Baseline/Forecast, Campaign/Operations, Insight 최대 3개, 독립 HTML |
| Connection Architecture | PARTIAL | 기존 Mock 읽기 계약과 서비스 재사용. 실제 매체별 요청/응답 매핑·쓰기 Adapter 필요 |
| Data Persistence | PARTIAL | 로컬 저장·메모리 fallback, Schema 1.0 Backup/Merge/Replace. 서버 DB·트랜잭션·동시 탭 동기화 없음 |
| Security | PARTIAL | 실제 자격 증명 없음, 환경 파일 제외, 안전한 HTML/CSV, Import 사전 검증. 서버 인증·권한·Secret 관리·독립 보안 검토 필요 |
| Testing | READY | Mock 단위·브라우저 회귀, TypeScript·프로덕션 빌드 검증. 실제 외부 통합 테스트는 별도 |
| API Integration | PARTIAL | GA4 서버 Read Only Adapter 및 Fixture 검증 완료. 실제 Credential/Property 통합은 미검증. Meta/ChatGPT Ads는 Mock |

## Connection Readiness

점수는 체크 항목 가중합입니다. Interface 20 / Mock Adapter 15 / Service 15 / Type 10 / Environment Schema 10 / 실제 Error Handling 10 / Credential 검증 10 / 실제 Integration Test 10.

| Connector | 준비도 | 남은 항목 |
| --- | --- | --- |
| GA4 | 80% | Read Only SDK·응답 매핑·오류 처리 완료. Property/권한/인증 및 실제 통합 검증 필요 |
| Meta Pixel / Dataset | 70% | 실제 이벤트 수집/CAPI, 동의·중복 제거·매칭 설계, 권한·오류 처리·통합 검증 |
| Meta Marketing API | 70% | 실제 읽기/쓰기 Adapter, 자산·권한·인증, 오류 처리·통합 검증 |
| ChatGPT Ads | 50% | 실제 제공 범위·이용 자격·공식 계약 확인, 전용 Interface/Adapter·인증·통합 검증 |
| Naver / Google Ads / Kakao / YouTube / CRM | 각각 10% | 공통 채널 타입 외 전용 계약/Adapter 준비 필요 |
| 전체 9개 평균 | 36% | 모든 Connector가 ACTION REQUIRED |

위 점수는 매체의 실제 연결 가능 여부나 성공 확률이 아닙니다. 기존의 일반 Mock 읽기 계약을 연결 준비 근거로 인정했으며, 실제 매체 전용 구현과는 구분합니다. GA4는 timeout/retry/cache 구현이 있으며 다른 매체는 정책 계약만 존재합니다.

## 데이터와 사용 제한

- 기본 모드의 모든 성과는 Mock입니다. 선택적 GA4 Real은 GA4_REAL_TEST.md의 범위와 제한을 따릅니다. 일자별 추이는 2026-09-17을 종료일로 하는 합성 배분이며 선택 기간의 기존 집계와 합계가 일치합니다. 기간을 바꾸면 별도 스냅샷을 배분하므로 실제 연속 일별 데이터로 비교할 수 없습니다.
- 전역 기간은 기존 계약대로 7/14/30D입니다. Custom Mock 날짜 범위는 지원하지 않습니다. Trend의 기간은 독립적으로 선택합니다.
- App Settings의 기본 시나리오는 Executive Report에 반영됩니다. Performance Lab은 기존 Baseline/광고주·기간별 저장 설정을 우선합니다.
- Backup 대상은 등록된 광고주 A/B의 영속 모델과 공통 설정입니다. 임시 화면 전달용 handoff, 현재 선택/열린 Modal, 임의 LocalStorage 키는 제외합니다.
- Merge 충돌은 기존 값을 유지합니다. Campaign 충돌 시 연관 Draft/Version/Rule/History/Alert도 함께 보존합니다. Replace는 미리보기와 교체 확인이 필요합니다.
- Import 전체 검증·Mock 의존 데이터 준비가 끝나기 전에는 쓰지 않습니다. 저장소 차단/용량 초과 시 메모리 복원 안내를 표시합니다. 여러 LocalStorage 키에 대한 DB 수준의 원자적 트랜잭션은 없으므로 이 경우 새로고침 전 백업해야 합니다.
- 동시 탭 갱신은 지원하지 않습니다. 한 탭의 검토 이후 변경은 fingerprint로 차단합니다. 실제 다중 사용자 운영에는 서버 버전 잠금과 트랜잭션이 필요합니다.

## 실제 API 연결 전에 해야 할 일

- [ ] 사용자가 Overview → Funnel → Performance → Campaign → Operations → Reports → Connections 전체 검수
- [ ] 백업 다운로드 후 별도 브라우저 프로필에서 복원 검수
- [ ] 실환경 목표·지표 정의·이벤트 중복 제거·직접/회수 구매 귀속 검토
- [ ] 서버 전용 Secret 관리, 인증·광고주별 권한·감사 정책 설계
- [ ] GA4 읽기 전용 Adapter와 계정/Property 권한 확인 계획 수립
- [ ] Meta Dataset/Pixel 이벤트 계약·동의·매칭·자산 권한 확인
- [ ] Meta Marketing 읽기 전용부터 실측 지표 매핑 검증
- [ ] 요청 timeout/retry/backoff/rate-limit, 만료 권한, 페이지네이션 처리 구현
- [ ] 실제 응답 Fixture·통합 테스트와 샌드박스 검증
- [ ] 실제 쓰기는 별도 승인·명시적 확인·멱등성·실패 복구·감사 이력 준비 후 제한적으로 활성화
- [ ] ChatGPT Ads는 공식 제공 범위/인증 계약을 확인한 뒤 별도 Adapter 설계

이 단계에서는 위 실연결 항목을 실행하지 않았습니다. 다음 작업은 새로운 대규모 Mock 기능 추가가 아니라 **사용자의 MVP 직접 검수**입니다.

최종 검증: 단위 37/37, Edge 브라우저 20/20 통과. `npm run typecheck` 오류 없음, `npm run build` 성공.
