# 대행사 역할 / Cloudtype 적용

## 권한

| DB 역할 | 범위 | 허용 작업 |
| --- | --- | --- |
| SUPER_ADMIN | 플랫폼 전체 | 기존 ADMIN 권한 전체, 사용자 승인·역할·배정, 시스템 설정, Audit, 연결 설정 |
| MANAGER | 배정된 활성 광고주 | Dashboard, Customer Journey, Performance, Campaigns, Operations, Reports, 연결 상태 조회 |
| ADVERTISER | 연결된 활성 광고주 | Dashboard, Customer Journey, Performance, Campaign Status, Reports 조회 |

MANAGER의 Connections는 상태 조회만 허용합니다. Property ID와 인증정보 관리, 연결 테스트, 시스템 설정 및 백업은 SUPER_ADMIN 전용입니다. 광고 계산·Connector·Credentials 로그인·Argon2id·PENDING 흐름은 유지합니다. 신규 환경변수는 없습니다.

## 승인 및 배정

1. 가입자는 역할 선택 없이 PENDING으로 생성됩니다.
2. SUPER_ADMIN은 관리 설정 → 사용자 관리 → 승인 대기에서 승인 모달을 엽니다.
3. MANAGER는 담당 광고주를 복수 선택하고, ADVERTISER는 소속 광고주 하나를 선택해 승인합니다.
4. 내부 마케터 필터 → 연결·권한 수정에서 광고주를 추가하거나 배정 칩의 ×로 제거하고 저장합니다.
5. 역할/배정 변경은 기존 Session 등록을 삭제합니다. 기존 쿠키로 다음 보호 요청을 보내면 거절되며 재로그인해야 합니다. 이미 내려받은 화면 내용까지 원격 삭제하는 기능은 아닙니다.

User ↔ AdvertiserMember ↔ Advertiser의 기존 N:N 관계와 복합키(userId, advertiserId)를 재사용합니다. User.role은 작업 권한을, Membership은 담당 Workspace 범위를 결정합니다. 같은 광고주에 여러 MANAGER를 배정할 수 있습니다. 마지막 ACTIVE SUPER_ADMIN의 강등·비활성화는 차단합니다.

`manager.assigned`, `manager.unassigned`, `role.changed`, `user.approved`, `workspace.access.changed`를 감사 기록에 남깁니다. actorUserId, resource(대상 사용자), 해당하는 advertiserId, createdAt을 사용합니다. 플랫폼 역할 변경에는 개별 advertiserId가 없으며 영향받는 배정은 별도 workspace.access.changed로 기록됩니다. 비밀번호·해시·Secret은 기록하지 않습니다.

## 데이터 마이그레이션

SQLite와 PostgreSQL에 `202609180002_agency_roles`를 추가했습니다. 기존 적용된 migration은 수정하지 않습니다.

```sql
UPDATE "User" SET "role" = 'SUPER_ADMIN' WHERE "role" = 'ADMIN';
UPDATE "AdvertiserMember" SET "role" = 'SUPER_ADMIN' WHERE "role" = 'ADMIN';
```

계정 ID, 비밀번호, 상태, Session, 광고주, Membership 행을 삭제하지 않습니다. ADVERTISER 역할과 배정도 유지합니다. User.role은 이미 String이므로 스키마/테이블 추가가 필요하지 않습니다. 앱은 DB 역할을 매 요청 읽으므로 기존 ADMIN 세션도 migration 후 SUPER_ADMIN 권한으로 해석됩니다.

## Cloudtype 순서

1. PostgreSQL 백업을 확보하고 유지보수 시간에 기존 앱 요청을 중지합니다. 구버전/신버전을 혼합해 서비스하지 마세요. 구버전은 SUPER_ADMIN을 인식하지 못하고 신버전은 미이전 ADMIN을 거부합니다.
2. 변경 소스로 Docker 이미지를 빌드합니다. 기존 Dockerfile이 PostgreSQL Prisma Client 생성과 production build를 수행합니다.
3. 동일 DB 환경변수를 사용하는 **새 이미지의 콘솔 또는 일회성 실행 환경**에서 아래 명령을 실행합니다. migration 완료 전 새 앱 트래픽을 개방하지 않습니다.

```sh
npm run env:check
npm run db:migrate:pg
npm run db:auth:check
```

4. `activeAdmins`가 기존 활성 관리자 수와 일치하는지 확인합니다. 이 진단 필드는 이제 SUPER_ADMIN을 셉니다. 새 앱을 재시작/전환하고 기존 관리자 로그인, 승인, MANAGER 담당 목록, 미배정 접근 차단을 확인합니다.
5. 기존 관리자에게 `db:admin` 또는 seed를 다시 실행하지 않습니다. **완전히 새로운 DB에만** 기존 `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`를 안전한 환경변수로 설정하고 `npm run db:admin`을 한 번 실행하면 SUPER_ADMIN을 생성합니다. 이후 초기 비밀번호 변수는 제거합니다.

DATABASE_URL, AUTH_SECRET, AUTH_URL 등 기존 설정과 GA4_DATA_MODE=mock을 유지합니다. 실제 값은 저장소에 넣지 않습니다. Docker 배포에는 별도 시작 명령 변경이 없습니다. `migrate reset`, 개발 seed, 데이터 삭제를 운영 DB에서 실행하지 않습니다. 롤백은 역할명을 임의 변경하는 대신 백업과 앱 버전을 함께 복구하는 절차로 준비합니다.

## 검증 범위

로컬 격리 DB에서 migration SQL이 기존 계정/비밀번호/Session/N:N 배정을 보존하는지 검증합니다. 브라우저 테스트는 SUPER_ADMIN, MANAGER 복수 배정, 다른 담당자의 Workspace ID 변조, 조회·쓰기, Connections 최소 권한, 역할/배정 변경 후 세션 취소 및 기존 인증/보안 회귀를 포함합니다. 실제 Cloudtype PostgreSQL에는 이 작업에서 접속하거나 migration을 실행하지 않습니다.
