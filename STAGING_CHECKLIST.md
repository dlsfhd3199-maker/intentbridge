# Staging 실제 환경 점검

로컬 검증을 실제 외부 배포 완료로 간주하지 않습니다.

- [ ] 별도 PostgreSQL / 최소 권한 DB 사용자 / 연결 풀
- [ ] APP_ENV=staging 및 환경 검증
- [ ] PG Client 생성 / PG migration deploy
- [ ] HTTPS / HTTP→HTTPS / Domain / AUTH_URL 일치
- [ ] Resend 도메인 검증 / 실제 이메일 수신 / 만료·단회 링크
- [ ] Admin Login / 첫 Workspace / 사용자 초대
- [ ] Advertiser A/B Login / 양방향 Tenant Isolation
- [ ] Disabled User 세션·재로그인 차단 / Last Admin 보호
- [ ] Login Email/IP·Invite·GA4·Import·Campaign·Operation Rate Limit
- [ ] 단일 memory 또는 shared database 정책 / 신뢰할 프록시 IP 처리
- [ ] Audit / Request ID / 로그 Secret·PII 비노출
- [ ] Transaction rollback / 동일 요청 retry
- [ ] 업무 JSON Backup 및 실제 DB Backup 각각 복원
- [ ] Error Handling / Email 실패 / 세션 만료 / 네트워크 오류
- [ ] Secure·HttpOnly·SameSite Cookie / CSP / HSTS
- [ ] Health / 관리자 System Readiness
- [ ] GA4 Mock / Meta Mock / Campaign Write Mock / Operations Mock
- [ ] 동일 PG Client로 Build / Start 성공
