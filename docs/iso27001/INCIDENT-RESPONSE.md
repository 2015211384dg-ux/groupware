# 정보보안 인시던트 대응 절차

**문서번호:** IRP-001  
**버전:** 1.0  
**작성일:** 2026-04-24  
**적용범위:** 그룹웨어 시스템 (10.18.10.70)  

---

## 1. 인시던트 분류

| 등급 | 정의 | 예시 | 대응 시간 |
|------|------|------|-----------|
| **P1 (긴급)** | 시스템 전체 중단 또는 데이터 유출 확인 | 서버 다운, 무단 DB 접근, 랜섬웨어 | 즉시 (1시간 내) |
| **P2 (높음)** | 일부 기능 장애 또는 의심스러운 접근 | 반복 로그인 실패, 이상 파일 업로드, 특정 기능 오류 | 4시간 내 |
| **P3 (보통)** | 단일 사용자 영향, 성능 저하 | 개인 계정 잠금, 느린 응답, 단순 오류 | 1영업일 내 |

---

## 2. 인시던트 감지 방법

### 2.1 자동 감지 (시스템)
- **계정 잠금 알림**: 비밀번호 5회 연속 실패 → 관리자 인앱 알림 즉시 발송
- **PM2 오류 로그**: `C:\groupware\logs\backend-error.log` 자동 기록
- **서버 헬스체크**: `GET /health` → 응답 없으면 PM2 자동 재시작 (max_restarts: 10)
- **감사 로그**: `audit_logs` 테이블 이상 접근 패턴

### 2.2 수동 감지 (사용자 신고)
- 그룹웨어 내 **피드백 메뉴** (버그/불편 신고)
- 직접 IT 담당자 연락

### 2.3 정기 점검
- 매일: PM2 로그 확인 (`pm2 logs groupware-backend --lines 100`)
- 매주: `system_logs` 경고(warning) 항목 검토
- 매월: `audit_logs` 비정상 접근 패턴 검토

---

## 3. 대응 절차

### STEP 1. 탐지 및 초기 평가 (15분 내)

```
인시던트 인지
    ↓
등급 분류 (P1 / P2 / P3)
    ↓
IT 관리자에게 즉시 보고
    ↓
인시던트 기록 시작 (날짜/시간/증상/발견자)
```

**초기 확인 명령어:**
```bash
# 서버 상태 확인
pm2 list
pm2 logs groupware-backend --lines 50 --nostream

# 현재 접속 세션 (DB)
"C:\Program Files\MariaDB 12.1\bin\mysql" --defaults-file=... -u groupware_app groupware \
  -e "SELECT user_id, COUNT(*) as cnt FROM refresh_tokens WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) GROUP BY user_id ORDER BY cnt DESC LIMIT 10;"

# 최근 로그인 실패
"C:\Program Files\MariaDB 12.1\bin\mysql" ... groupware \
  -e "SELECT message, ip_address, created_at FROM system_logs WHERE log_type='warning' ORDER BY created_at DESC LIMIT 20;"
```

---

### STEP 2. 격리 (P1 즉시 / P2 4시간 내)

#### 계정 침해 의심 시
```sql
-- 해당 계정 즉시 비활성화
UPDATE users SET is_active = FALSE WHERE username = '해당계정';

-- 해당 계정 토큰 전체 폐기
DELETE FROM refresh_tokens WHERE user_id = (SELECT id FROM users WHERE username = '해당계정');
```

#### 시스템 전체 격리 필요 시 (P1)
```bash
# 점검 모드 즉시 활성화 (그룹웨어 설정 > 시스템 점검 모드 ON)
# 또는 직접 DB 업데이트
"C:\Program Files\MariaDB 12.1\bin\mysql" ... groupware \
  -e "UPDATE system_settings SET maintenance_mode = 1, maintenance_message = '보안 점검 중입니다. 잠시 후 재접속해주세요.' WHERE id = 1;"
```

#### 서버 긴급 중단 필요 시
```bash
pm2 stop groupware-backend
```

---

### STEP 3. 조사

#### 로그 수집
```bash
# 시스템 로그 내보내기
"C:\Program Files\MariaDB 12.1\bin\mysql" ... groupware \
  -e "SELECT * FROM system_logs WHERE created_at >= '인시던트 발생일시' ORDER BY created_at;" > incident_syslog.txt

# 감사 로그 내보내기
"C:\Program Files\MariaDB 12.1\bin\mysql" ... groupware \
  -e "SELECT * FROM audit_logs WHERE created_at >= '인시던트 발생일시' ORDER BY created_at;" > incident_auditlog.txt

# PM2 전체 로그
pm2 logs --nostream > incident_pm2log.txt
```

#### 조사 체크리스트
- [ ] 최초 이상 징후 발생 시각 특정
- [ ] 관련 IP 주소 확인 (`system_logs.ip_address`)
- [ ] 영향받은 사용자/데이터 범위 파악
- [ ] 공격 경로 (어느 엔드포인트 통해 진입했는가)
- [ ] 데이터 유출 여부 확인 (`audit_logs` 이상 열람)
- [ ] 업로드 파일 중 의심 파일 확인 (`uploads/` 디렉토리 검사)

---

### STEP 4. 복구

| 상황 | 복구 방법 |
|------|-----------|
| 서버 프로세스 다운 | `pm2 restart groupware-backend --update-env` |
| DB 데이터 손상 | 백업 복원 (BACKUP-RECOVERY.md 참조) |
| 계정 침해 후 재활성화 | 비밀번호 초기화 후 `require_password_change = 1` 설정, `is_active = TRUE` |
| 악성 파일 발견 | 해당 파일 삭제, DB에서 attachment 레코드 삭제, 업로더 계정 조사 |
| 토큰 전체 무효화 | `TRUNCATE TABLE refresh_tokens;` (전 사용자 재로그인 필요) |

**복구 후 검증:**
```bash
# 서버 정상 응답 확인
curl http://10.18.10.70:3000/health

# DB 연결 확인
pm2 logs groupware-backend --lines 5 --nostream | grep "데이터베이스"
```

---

### STEP 5. 사후 검토 (48시간 내)

인시던트 종료 후 다음 항목을 기록하고 **보안 정책 업데이트**에 반영:

| 항목 | 내용 |
|------|------|
| 발생 일시 | |
| 등급 | P1 / P2 / P3 |
| 원인 | |
| 영향 범위 | 영향받은 사용자 수, 데이터 종류 |
| 대응 조치 | |
| 재발 방지 대책 | |
| 정책/코드 변경 필요사항 | |

---

## 4. 시나리오별 대응

### 시나리오 A: 계정 무단 접근 의심

**증상:** 동일 계정으로 다른 IP에서 동시 접속, 비정상 시간대 접속

```sql
-- 해당 사용자 최근 로그인 이력
SELECT message, ip_address, created_at FROM system_logs
WHERE user_id = ? AND log_type IN ('success','warning')
ORDER BY created_at DESC LIMIT 20;

-- 현재 유효 세션 수
SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND expires_at > NOW();
```

**조치:** 해당 계정 refresh_tokens 전체 삭제 → 강제 로그아웃 → 비밀번호 초기화

---

### 시나리오 B: 악성 파일 업로드 시도

**증상:** 파일 업로드 API에서 400 오류 반복, MIME 검증 실패 로그

```bash
# PM2 로그에서 MIME 오류 패턴 확인
pm2 logs groupware-backend --nostream | grep "MIME\|파일 형식\|확장자"
```

**조치:** 업로더 계정 조사, 실제 저장된 파일 확인 (`uploads/` 디렉토리), 필요 시 계정 잠금

---

### 시나리오 C: 서버 다운 (P1)

**증상:** http://10.18.10.70:3000 접속 불가

```bash
# 1. PM2 상태 확인
pm2 list

# 2. 에러 로그 확인
pm2 logs groupware-backend --lines 30 --nostream

# 3. 포트 점유 확인
netstat -ano | findstr :3000
netstat -ano | findstr :5001

# 4. 재시작
pm2 restart groupware-backend --update-env

# 5. DB 연결 문제 시 MariaDB 서비스 확인 (Windows 서비스 관리자)
```

---

### 시나리오 D: DB 접근 이상 (쿼리 급증, 비정상 접근)

```sql
-- 현재 DB 프로세스 확인
SHOW PROCESSLIST;

-- 1시간 내 refresh_tokens 과다 생성 (세션 탈취 의심)
SELECT user_id, COUNT(*) as cnt FROM refresh_tokens
WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY user_id HAVING cnt > 10;
```

**조치:** 의심 user_id의 토큰 전체 삭제, 계정 잠금, 로그 보존 후 조사

---

## 5. 연락 체계

| 역할 | 담당 | 연락 방법 |
|------|------|-----------|
| 1차 대응 (IT 관리자) | SUPER_ADMIN 계정 담당자 | 그룹웨어 내부 메시지 / 직접 연락 |
| 2차 에스컬레이션 | 팀장 또는 임원 | P1 발생 시 즉시 보고 |
| 외부 지원 | 서버 하드웨어 벤더, 보안 업체 | P1 장기화 시 |

> **P1 인시던트는 발생 즉시 경영진에게 보고**
