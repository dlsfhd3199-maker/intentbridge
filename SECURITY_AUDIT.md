# Production Foundation 검수 · 2026-09-17

## 검수 범위와 결과

- 기존 Auth.js database session·이메일 단회 토큰·CSRF를 유지했습니다. 저장된 세션 토큰은 해시이며 비활성 사용자와 만료 세션은 서버에서 거부합니다.
- ADMIN/ADVERTISER, 양방향 Workspace IDOR, 직접 API 접근, 마지막 관리자 보호, 중복 초대, 상태 변경 시 세션 폐기를 자동 검증합니다.
- Staging/Production은 Secure Cookie를 강제하고 설치된 Auth.js의 HttpOnly/SameSite=Lax 기본값을 사용합니다. 실제 HTTPS 도메인의 Cookie 검사는 Staging 체크리스트에 남겼습니다.
- nonce CSP, nosniff, no-referrer, Permissions-Policy 및 배포 환경 HSTS를 적용했습니다. Auth CSRF 동작과 기존 화면의 콘솔/외부 요청 회귀를 확인합니다.
- 서버에서 광고주 범위·도메인 타입·예산·이메일·문자열 길이·Secret 필드·revision을 검사합니다. 잘못된 입력은 400, 충돌은 409, 제한 초과는 429입니다.
- Login Email/IP, Invite, GA4 Test, Import, Campaign 생성, Operation 변경에 서버 Rate Limit을 적용했습니다. 원문 IP를 저장하지 않습니다. Production은 공유 DB 저장소를 요구합니다.
- 원자적 문서 배치의 중간 실패 시 DB/Audit이 함께 롤백됩니다. 성공 응답만 유실된 경우에도 동일 키 재시도는 Campaign/Audit을 중복 생성하지 않습니다.
- 코드·문서·스키마 205개 파일의 알려진 자격 증명 패턴 검사에서 발견 0건. 빌드의 브라우저 JavaScript 27개에서 Secret 환경변수 접근/자격 증명 패턴 발견 0건. 패턴 검사는 모든 유출 가능성의 증명이 아닙니다.
- 현재 폴더에는 `.git` 메타데이터가 없어 Git 이력/기존 원격 저장소는 검수하지 않았습니다. `.env*`, DB 파일, credentials/secrets/키 파일은 제외 규칙을 유지했습니다.
- `npm audit`: 취약점 0건. Auth.js beta 사용 여부는 운영 승격 시 다시 검토합니다.
- 실제 Resend/GA4/Meta 계정이나 API를 호출하지 않았습니다. 이메일 테스트는 별도 로컬 수신기로 전송했습니다.
- Reference HTML SHA256: `280954424FA392D46B7F93656ADC41141831EB92F25AD8FFB1EB0C4F5E087EDA` (변경 없음).

## 성능과 운영상 한계

Bootstrap에서 Campaign/History 원문을 제외하고 Dashboard 요약을 서버에서 계산합니다. 관리자 요약은 광고주별 쿼리를 반복하지 않고 묶어서 조회합니다. 편집 화면은 해당 Workspace 문서 로딩 후 열립니다. Users/Advertisers/Audit에 cursor/limit을 적용하고 저장 투영은 createMany로 처리합니다.

현재 관리 UI는 첫 페이지이며 초기 광고주 catalog/요약은 최대 100개입니다. 대규모 운영 전 페이지 UI와 JSON 문서의 행 단위 편집 전환이 필요합니다. 자동 보존 삭제 작업·실제 DB 백업/복구·분산 부하 시험은 운영 환경 작업입니다.

PostgreSQL 스키마 검증·Client 생성·빌드 호환성을 확인했습니다. 실제 PostgreSQL 서버가 없으므로 migration 적용, 공유 DB Rate Limit 및 Serializable 동시성은 실제 Staging에서 추가 검증해야 합니다. 실제 외부 배포·메일 전달·HTTPS 검증은 수행하지 않았습니다.

배포 및 외부 검증 항목: [DEPLOYMENT.md](DEPLOYMENT.md), [STAGING_CHECKLIST.md](STAGING_CHECKLIST.md), [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

## 최종 자동 검증 결과

2026-09-17: Unit 55/55, Edge Browser 50/50 통과. TypeScript 오류 0, Lint 통과, `npm run build` 성공. 기존 Home/Funnel/Performance/Campaign/Operations/Reports/Connections 및 사용자·광고주 관리 회귀를 포함합니다. 신규 검증은 원자적 실패 롤백, idempotency/응답 유실 복구, 음수 예산·잘못된 입력, 요청 제한, 이메일 실패, 비활성 로그인, 최소 Health/Admin Readiness입니다. 실제 외부 API 호출 없이 로컬 테스트 메일 수신기를 사용했습니다.
