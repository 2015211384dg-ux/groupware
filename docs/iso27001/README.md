# ISO 27001 대응 문서

그룹웨어 시스템의 ISO 27001 인증 대응을 위한 정책 및 절차 문서 모음입니다.

| 문서 | 파일 | ISO 27001 조항 | 설명 |
|------|------|----------------|------|
| 정보보안 정책서 | [SECURITY-POLICY.md](SECURITY-POLICY.md) | A.5, A.9, A.10 | 정보자산 분류, 접근통제, 암호화, 로그 정책 |
| 인시던트 대응 절차 | [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md) | A.16 | 인시던트 분류, 탐지·격리·복구·사후검토 절차 |
| 백업 및 복구 계획 | [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md) | A.17 | 백업 주기·절차, 복구 시나리오, RTO/RPO |

## 기술적 보안 통제 구현 현황

코드레벨 구현 사항은 Git 커밋 히스토리 참조:
- `security(iso27001): fix CSRF cookie flag, apply password policy` — 1단계
- `security(iso27001): uploads auth, magic-link one-time use, MIME validation` — 2단계
- `security(iso27001): CSP headers, idle timeout, security alerts, audit log` — 3단계

## 정기 점검 일정

| 항목 | 주기 | 담당 |
|------|------|------|
| PM2 오류 로그 확인 | 매일 | IT 관리자 |
| system_logs 경고 검토 | 매주 | IT 관리자 |
| audit_logs 이상 접근 검토 | 매월 | IT 관리자 |
| 백업 복구 테스트 | 분기 | IT 관리자 |
| 보안 정책 검토 | 연 1회 | IT 관리자 + 경영진 |
