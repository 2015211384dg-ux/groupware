# 백업 및 복구 계획

**문서번호:** BRP-001  
**버전:** 1.0  
**작성일:** 2026-04-24  
**적용범위:** 그룹웨어 시스템 (10.18.10.70)  

---

## 1. 보호 대상 자산

| 자산 | 위치 | 크기 (예상) | 중요도 |
|------|------|-------------|--------|
| MariaDB 데이터베이스 | localhost:3300, DB명: `groupware` | ~25MB/년 (50명 기준) | **최고** |
| 업로드 파일 | `C:\groupware\backend\uploads\` | 사용량에 따라 증가 | 높음 |
| 시스템 설정 파일 | `C:\groupware\backend\.env` | 1KB | 최고 |
| 애플리케이션 코드 | GitHub (https://github.com/2015211384dg-ux/groupware) | — | 중간 (GitHub 백업) |

---

## 2. 백업 정책

| 항목 | 기준 |
|------|------|
| **RTO** (목표 복구 시간) | 2시간 이내 |
| **RPO** (목표 복구 시점) | 24시간 이내 (일별 백업 기준) |
| 백업 주기 | **매일 새벽 2시** (DB + 파일) |
| 백업 보관 기간 | 최근 7일 일별 + 최근 4주 주별 + 최근 3개월 월별 |
| 백업 저장 위치 | 별도 외부 드라이브 또는 NAS (`\\백업서버\groupware-backup\`) |
| 백업 암호화 | zip 압축 + 비밀번호 보호 (운영 관리자만 알고 있는 비밀번호) |

---

## 3. 백업 절차

### 3.1 DB 백업 (mysqldump)

```bash
# 실행 위치: 그룹웨어 서버 (10.18.10.70)
# 저장 위치 예시: D:\Backup\groupware\

set BACKUP_DIR=D:\Backup\groupware
set DATE=%date:~0,4%%date:~5,2%%date:~8,2%

"C:\Program Files\MariaDB 12.1\bin\mysqldump.exe" ^
  --defaults-file=C:\groupware\backup\my-backup.cnf ^
  --single-transaction ^
  --routines ^
  --triggers ^
  --host=127.0.0.1 ^
  --port=3300 ^
  groupware > %BACKUP_DIR%\groupware_db_%DATE%.sql

# 압축 (7-Zip 사용 시)
"C:\Program Files\7-Zip\7z.exe" a -tzip -p[백업비밀번호] ^
  %BACKUP_DIR%\groupware_db_%DATE%.zip ^
  %BACKUP_DIR%\groupware_db_%DATE%.sql

del %BACKUP_DIR%\groupware_db_%DATE%.sql
```

**my-backup.cnf 내용** (`C:\groupware\backup\my-backup.cnf`):
```ini
[client]
user=groupware_app
password=436edd515583525da4a3f5f55fb357dbbfd8f292f898dd6bcf09ced714a6bdf4f8f1724caadbecea3eb5d9c9a68f1036
```
> 이 파일은 관리자만 읽을 수 있도록 권한 설정 필요

### 3.2 업로드 파일 백업

```bash
# uploads 디렉토리 전체 압축 백업
"C:\Program Files\7-Zip\7z.exe" a -tzip ^
  %BACKUP_DIR%\groupware_uploads_%DATE%.zip ^
  C:\groupware\backend\uploads\
```

### 3.3 환경 설정 백업

```bash
# .env 파일 백업 (별도 보안 위치에 저장)
copy C:\groupware\backend\.env %BACKUP_DIR%\env_%DATE%.bak
```
> `.env`는 DB 비밀번호, JWT 시크릿 포함 → 암호화된 위치에 별도 보관

### 3.4 Windows 작업 스케줄러 등록

```
작업 이름: GroupwareBackup
트리거: 매일 오전 2:00
동작: 위 백업 스크립트 실행 (C:\groupware\backup\backup.bat)
조건: 컴퓨터가 유휴 상태일 때
```

**backup.bat 예시:**
```bat
@echo off
set BACKUP_DIR=D:\Backup\groupware
set DATE=%date:~0,4%%date:~5,2%%date:~8,2%

REM DB 백업
"C:\Program Files\MariaDB 12.1\bin\mysqldump.exe" ^
  --defaults-file=C:\groupware\backup\my-backup.cnf ^
  --single-transaction --host=127.0.0.1 --port=3300 ^
  groupware > %BACKUP_DIR%\groupware_db_%DATE%.sql

REM 파일 백업
"C:\Program Files\7-Zip\7z.exe" a -tzip ^
  %BACKUP_DIR%\groupware_uploads_%DATE%.zip ^
  C:\groupware\backend\uploads\

REM 7일 이상 된 일별 백업 삭제
forfiles /p %BACKUP_DIR% /s /m groupware_db_*.sql /d -7 /c "cmd /c del @path" 2>nul
forfiles /p %BACKUP_DIR% /s /m groupware_uploads_*.zip /d -7 /c "cmd /c del @path" 2>nul

echo 백업 완료: %DATE% >> C:\groupware\logs\backup.log
```

---

## 4. 복구 절차

### 4.1 DB 복구

```bash
# 1. 현재 서버 중단
pm2 stop groupware-backend

# 2. 기존 DB 백업 (혹시 모를 현재 데이터 보존)
"C:\Program Files\MariaDB 12.1\bin\mysqldump.exe" ^
  --defaults-file=C:\groupware\backup\my-backup.cnf ^
  --single-transaction --host=127.0.0.1 --port=3300 ^
  groupware > D:\Backup\groupware\emergency_before_restore.sql

# 3. 복원할 백업 파일 압축 해제
"C:\Program Files\7-Zip\7z.exe" e groupware_db_YYYYMMDD.zip -o%TEMP%\gwrestore\

# 4. DB 복원
"C:\Program Files\MariaDB 12.1\bin\mysql" ^
  --defaults-file=C:\groupware\backup\my-backup.cnf ^
  --host=127.0.0.1 --port=3300 ^
  groupware < %TEMP%\gwrestore\groupware_db_YYYYMMDD.sql

# 5. 서버 재시작
pm2 restart groupware-backend --update-env

# 6. 정상 작동 확인
pm2 logs groupware-backend --lines 10 --nostream
curl http://10.18.10.70:3000/health
```

### 4.2 업로드 파일 복구

```bash
# uploads 디렉토리 복원
"C:\Program Files\7-Zip\7z.exe" x groupware_uploads_YYYYMMDD.zip ^
  -oC:\groupware\backend\ -aoa
```

### 4.3 전체 서버 재구축 (최악의 경우)

새 서버에서 다음 순서로 진행:

```
1. Node.js 설치 (현재 버전 확인: node --version)
2. MariaDB 12.1 설치 (port 3300 설정)
3. PM2 설치: npm install -g pm2
4. GitHub에서 코드 다운로드:
   git clone https://github.com/2015211384dg-ux/groupware.git C:\groupware
5. 의존성 설치:
   cd C:\groupware\backend && npm install
   cd C:\groupware\frontend && npm install && npm run build
6. .env 파일 복원 (백업에서)
7. DB 생성 및 복원:
   CREATE DATABASE groupware CHARACTER SET utf8mb4;
   CREATE USER 'groupware_app'@'localhost' IDENTIFIED BY '...비밀번호...';
   GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES ON groupware.* TO 'groupware_app'@'localhost';
   mysql -u root groupware < groupware_db_YYYYMMDD.sql
8. 업로드 파일 복원
9. PM2로 서버 시작:
   pm2 start C:\groupware\ecosystem.config.js
   pm2 save
10. 접속 확인: http://새IP:3000
```

---

## 5. 백업 검증 절차

**월 1회** 다음 항목을 반드시 확인:

| 점검 항목 | 확인 방법 | 담당 |
|-----------|-----------|------|
| 백업 파일 생성 여부 | `backup.log` 확인, 파일 날짜 확인 | IT 관리자 |
| 백업 파일 무결성 | zip 파일 테스트 추출 시도 | IT 관리자 |
| **복구 테스트** | 개발 PC에서 실제 복원 후 접속 확인 | IT 관리자 |
| 백업 저장소 용량 | D:\Backup 여유 공간 확인 | IT 관리자 |

**복구 테스트 방법 (개발 PC에서):**
```bash
# 개발 PC에서 별도 DB(groupware_test)로 복원 테스트
mysql -u root groupware_test < groupware_db_최신파일.sql
# 데이터 건수 확인
mysql -u root groupware_test -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM approval_documents;"
```

---

## 6. 백업 실패 대응

`backup.log`에 오류 기록 시:

```
[오류 유형 1] 디스크 공간 부족
→ 오래된 백업 파일 수동 삭제, 백업 드라이브 교체 검토

[오류 유형 2] DB 연결 실패 (access denied)
→ my-backup.cnf 비밀번호 확인, groupware_app 계정 상태 확인

[오류 유형 3] 백업 파일이 0KB
→ mysqldump 오류 로그 확인, DB 서비스 상태 확인
   Services.msc → MariaDB 서비스 상태
```

---

## 7. 복구 시나리오별 RTO 예상

| 시나리오 | 예상 복구 시간 |
|----------|---------------|
| PM2 프로세스 재시작 | 1분 |
| 부분 데이터 복원 (특정 테이블) | 15분 |
| 전체 DB 복원 (백업에서) | 30분 |
| 전체 서버 재구축 (새 PC) | 2시간 |

---

## 8. 문서 관리

| 항목 | 내용 |
|------|------|
| 문서 소유자 | IT 관리자 |
| 검토 주기 | 연 1회, 시스템 변경 시 즉시 업데이트 |
| 복구 테스트 주기 | 분기 1회 |
| 다음 복구 테스트 예정 | 2026-07-24 |
