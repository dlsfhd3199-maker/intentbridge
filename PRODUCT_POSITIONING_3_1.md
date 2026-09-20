# Product Positioning 3.1 / Advertiser Management

## 제품 메시지와 Public 흐름

IntentBridge는 브랜드·인하우스 마케팅팀·퍼포먼스 마케터·광고 운영팀·에이전시가 광고 유입 이후의 고객 행동과 다음 액션을 연결하는 제품이다. Design System 3.0의 Editorial Data Workspace를 유지한다.

- Hero → Journey → Decision / Action → Result → One Workspace의 5개 흐름.
- Hero: `광고 유입을, 구매까지 연결합니다.` 유지. 조직 역할 중심 설명 제거.
- 비로그인 CTA: 제품 체험하기 → 공개 Product Experience(`#product`), 로그인 → `/login`.
- 로그인 CTA: 내 Workspace 열기 → `/dashboard`, 제품 살펴보기 → `#product`.
- 미래 Demo Route는 만들지 않았다. `publicEntryTargets`가 진입 위치만 정의하며 세션 조회는 그대로다.
- 공개 데이터는 기존 Mock fixture를 재사용한다. 1,284 → 1,082 → 326 → 174 → 41, 최대 이탈 756명.
- Recovery는 미구매 1,243 / 현재 가능 742 / 최근 14일 장바구니 선택 198의 정의를 구분한다.
- 예상 구매 94 → 113, 매출 13,690,000 → 16,428,000은 기존 예시 산식이며 실제 성과를 보장하지 않는다.
- 다채널 안내와 Demo / Planned 표기를 유지한다.
- 1440px 전체 캡처 기준 높이: 3.0의 4,517px → 3.1의 3,914px, 약 13.3% 감소.

## 광고주 관리

`/advertisers`에서 Dashboard 재사용을 제거했다. 인라인 현황 → 검색 / 필터 → 광고주 목록 → Workspace 진입 순서다. Journey, 상세 성과, 활동 Rail은 기존 Dashboard에 남는다. 관리 화면에서는 중복된 전역 검색과 현재 광고주 선택을 숨기고 목록 검색을 사용한다. 조회 기간은 작은 ROAS 요약에 적용한다.

기존 API만 사용한다.

- `/api/admin/advertisers`: 기존 cursor pagination으로 광고주 목록 조회; 기존 POST/PATCH와 Idempotency-Key로 저장.
- `/api/workspaces/:id/platform`: ACTIVE Workspace의 담당자, Demo 연결, 마지막 동기화, 설정 상태.
- `/api/admin/workspace-summaries`: 선택한 기간의 ROAS 요약.
- 비활성 Workspace에는 접근 링크를 제공하지 않는다. 사용자 관리는 기존 `/settings`에서 접근한다.
- 부분 조회 실패는 `확인 불가`와 재시도로 처리한다. 데이터가 없는 ROAS는 `—`, 동기화는 `기록 없음`이다.
- 연결 분모는 예시 숫자를 하드코딩하지 않고 기존 Connector Catalog의 길이를 사용한다.
- `활성`은 DB의 ACTIVE 상태, `설정 중` / `확인 필요`는 기존 플랫폼 상태다. 중복될 수 있는 서로 다른 기준이다.
- 생성/수정 폼은 네이티브 dialog Drawer다. Escape/취소/초점 복원, 저장 중 중복 제출 방지를 제공한다.
- ACTIVE 생성 후 기존 데이터 연결 설정으로 이동한다. DISABLED 생성 후 목록으로 이동한다. 수정 후 기존 전체 새로고침 방식으로 공통 Workspace 정보도 갱신한다.
- 첫 Workspace가 없는 초기 화면도 동일한 생성 Drawer를 사용한다. 인증/Bootstrap 판정은 바꾸지 않는다.
- Mobile은 광고주, 담당자, Workspace 상태, 연결, 상태, 진입 Action을 Row/Stack으로 보여준다.

## 권한 유지

SUPER_ADMIN만 기존 광고주 관리 Route/API에 접근한다. MANAGER는 기존 `내 광고주`(`/dashboard#assigned-workspaces`)와 배정된 Workspace 흐름을 유지하며 `/advertisers` 접근은 여전히 403이다. ADVERTISER의 관리 메뉴/쓰기 제한도 그대로다. Auth.js, Permission, Membership, Tenant Isolation, API guard, DB schema, Secret, 배포 설정 변경은 없다.

## 배포 검토

화면이 바뀌어 기존 보안 회귀의 UI 진입 단계/선택자만 수정했다.

- `tests/browser/security.spec.ts`: 생성 Drawer 열기 추가; 제거된 성과 테이블 대신 광고주 목록을 확인. 저장/승인/Audit 검증 유지.
- `tests/browser/permissions.spec.ts`: 제거된 Dashboard Action Queue 대신 광고주 목록에서 Workspace 진입. 역할/메뉴/격리 검증 유지.

현재 Deployment Policy는 위 테스트 파일 변경을 `DEPLOYMENT_INFRASTRUCTURE / Security gate regression coverage`로 분류한다. 실제 권한 로직 변경이 없어도 더 엄격한 `MANUAL_REVIEW (HIGH)`를 따른다. Policy 수정, 테스트 이동/삭제, reviewed_sha 우회는 하지 않는다. 이 변경에 대한 명시적 승인 전 Commit/Push/Staging 배포를 보류한다.

기존 Operations 브라우저 회귀의 초안 복제/삭제 단계는 서버 자동 저장 완료를 기다린 뒤 다음 작업을 수행하도록 동기화했다. 행 수·복제·삭제·Export 검증과 Campaign 기능 코드는 유지한다.

## 변경 파일

- `app/page.tsx`
- `features/public/public-session.tsx`
- `features/public/product-preview.tsx`
- `features/public/public.css`
- `app/(workspace)/advertisers/page.tsx`
- `features/admin/advertiser-management.tsx` (신규)
- `features/admin/advertiser-management.css` (신규)
- `features/admin/management.tsx` (기존 API helper 재사용, 사용자 관리 유지)
- `components/app-shell.tsx` (광고주 관리 화면의 중복 Context UI 정리)
- `components/workspace-bootstrap.tsx` (광고주 관리 컴포넌트 import만 교체)
- `tests/browser/advertiser-management.spec.ts` (신규)
- `tests/browser/public-website.spec.ts`
- `tests/browser/security.spec.ts`
- `tests/browser/permissions.spec.ts`
- `tests/browser/operations.spec.ts`
- `PRODUCT_POSITIONING_3_1.md` (이 문서)

## 최종 검증 결과

- TypeScript / ESLint: 통과.
- Unit: 68/68 통과.
- Deployment Policy 테스트: 32/32 통과.
- `npm run build`: 성공.
- 전체 Browser: 76/76 통과 (최종 실행 3.9분).
- Operations 초안 복제/삭제/Export: 저장 완료 동기화 후 별도 3회 연속 통과, 이후 전체 Browser에서도 통과.
- Public CTA/앵커/세 역할, 관리 검색/필터/부분 오류/재시도/Drawer/생성/수정/비활성 상태/Workspace 진입 검증.
- 1440 / 1366 / 1024 / 768 / 390: 반응형, 가로 넘침, 목록/Drawer 화면 검수. Public 대비 검사 및 기존 주요 제품 화면 캡처 유지.
- Secret Scan: 검출 0. `git diff --check`: 통과.
- 신규 Commit 없음. Push / GitHub Actions / Cloudtype 배포 미실행. 기존 배포 정책의 MANUAL_REVIEW 결정을 따른다.
