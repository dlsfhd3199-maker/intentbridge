# Production 승격 점검

Staging 검증 후 별도 운영 환경에서 진행합니다.

- [ ] 운영 PostgreSQL / 연결 풀 / 데이터 이관 계획
- [ ] Database Backup·PITR·암호화·복구 리허설
- [ ] Secret Manager / 권한 최소화 / 키 회전
- [ ] Domain / HTTPS / HSTS / 프록시 신뢰
- [ ] Email Domain Verification / 배달 실패 모니터링
- [ ] APP_ENV=production / Shared database Rate Limit 또는 검증된 Redis Adapter
- [ ] 분산 중복 요청·Serializable 충돌·부하 시험
- [ ] 운영 migration deploy / 검토된 forward-fix·복구 절차
- [ ] Logging 수집 / Auth URL query·민감 헤더 redaction
- [ ] Monitoring: liveness·DB·로그인 실패·429·5xx·저장 지연
- [ ] Audit·Alert·History 보존 및 정리 정책
- [ ] 만료 Session·VerificationToken·Receipt·RateBucket 정리
- [ ] 관리자 복구 담당자 / Incident Recovery 절차
- [ ] 실제 데이터량에 맞춘 Pagination UI·편집 문서 크기 점검
- [ ] Auth.js beta 릴리스·취약점·운영 인증 보안 검수
- [ ] 전체 회귀 / 실제 Secure Cookie·이메일·Tenant Isolation
- [ ] Meta/Campaign/Operations Mock 유지 확인
