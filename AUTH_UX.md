# 로그인 / 인증 진입 UX

## 변경 범위

- 하나의 최대 960px 컨테이너 안에 상단 브랜드·하단 로그인 영역을 배치했습니다. 고정 높이나 최소 높이로 공간을 채우지 않습니다.
- 기존 심볼의 크기·형태·색상과 IntentBridge 워드마크를 유지합니다. Navy, Mint, Violet, Warm Gray를 사용합니다.
- Desktop/Tablet은 위아래 구조를 유지하고 넓은 화면에서는 이메일 입력과 CTA를 나란히 배치합니다. Mobile은 패딩·타이포를 줄이고 입력/CTA를 두 줄로 배치합니다.
- 로그인 상태 확인 → 이메일 입력 → 전송 중 → 발송 안내/오류 상태를 같은 컨테이너에 표시합니다. 브랜드 영역은 유지됩니다.
- 전송 중 중복 입력을 막고, 성공 안내에서 이메일을 마스킹합니다. 다른 이메일 사용 시 입력으로 포커스를 돌려줍니다. 이메일을 URL/브라우저 저장소에 남기지 않습니다.
- Label, 입력 오류 설명, aria-invalid, aria-busy, 상태 알림, 키보드 포커스를 제공합니다.
- 접근 제한 HTTP 403 응답은 표시 HTML만 변경했습니다. 미저장 작업이 있는 세션 만료 안내 역시 표시만 변경했습니다.

## 기존 인증과의 경계

Auth.js 설정, Resend 발송, DB Session, Role, 권한 판정, Tenant Isolation, DB와 서버 Route Guard는 그대로입니다. 로그인 UI는 기존 세션 조회 API로 상태를 확인하고, 로그인된 사용자를 기존 `/` 진입점으로 보냅니다. 관리자/광고주 분기는 기존 Dashboard가 담당합니다. 로그인 요청의 기존 `redirectTo: "/"`를 유지하고 역할 선택이나 새 로그인 방식을 추가하지 않았습니다.

주요 파일: `app/login/page.tsx`, `components/auth/auth-frame.tsx`, `lib/auth-presentation.ts`, `app/forbidden.tsx`, `components/access-gate.tsx`, `components/session-monitor.tsx`. `proxy.ts`는 기존 403 응답의 HTML만 공통 프레젠테이션으로 교체했습니다. `app/globals.css`에서는 이전 로그인 전용 스타일만 제거했습니다.

## 검증

1366 / 1024 / 768 / 390px에서 상하 순서·가로 넘침·입력·CTA·키보드를 검증하고 스크린샷을 확인했습니다. 390×800에서 CTA가 첫 화면 안에 표시됩니다. 성공/오류 안내, 세션 확인 중 폼 숨김, 관리자/광고주 진입, 403, 만료 링크, 미저장 세션 만료를 추가 검증했습니다.

UI 상태 일부는 Playwright의 응답 제어로 재현하고, 실제 Auth.js 인증/메일 실패/Disabled User는 기존 로컬 메일 수신기 기반 보안 테스트로 검증합니다. 외부 Resend/GA4/Meta API 호출은 하지 않았습니다.

최종 결과: Unit 55/55, Edge Browser 55/55 통과. TypeScript·Lint 통과, npm run build 성공. 기존 Auth/Permission/Security 및 업무 화면 회귀 포함.
