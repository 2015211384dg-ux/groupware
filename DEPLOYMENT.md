# 그룹웨어 배포 가이드 (내부망 · Node.js 단독 구성)

> 대상: 사내 전용 Windows 온프레미스 신규 서버 배포  
> 구성: Windows + Node.js + PM2 + MariaDB  
> 용도: 내부망 전용, HTTP 운영

---

## 전체 구조

```
사내 PC 브라우저
      ↓  (3000 포트 — 방화벽 오픈 대상)
   Vite 프론트엔드 서버 (PM2: groupware-frontend)
      ↓  /api/* 프록시
   Node.js 백엔드 (PM2: groupware-backend, 5001 포트 — 내부 전용)
      ↓  (3300 포트)
   MariaDB 데이터베이스
```

> 사용자는 **3000 포트**로 접속합니다.  
> 5001 포트(백엔드)는 서버 내부에서만 사용하며 외부 방화벽 오픈 불필요합니다.

---

## 권장 서버 사양

| 항목 | 최소 | 권장 |
|------|------|------|
| OS | Windows 10 Pro | Windows Server 2019/2022 |
| CPU | 2코어 | 4코어 이상 |
| RAM | 4GB | 8GB 이상 |
| 저장소 | 100GB | 200GB 이상 (업로드 파일 증가 고려) |
| 네트워크 | 사내 고정 IP 필수 | 유선 연결 권장 |

---

## 1단계. 필수 소프트웨어 설치

### 1-1. Node.js 설치

1. https://nodejs.org 에서 **LTS 버전 (v22.x 이상)** 다운로드
2. 설치 시 "Add to PATH" 옵션 체크
3. 설치 확인:

```powershell
node -v   # v22.x.x 이상
npm -v    # 10.x.x 이상
```

### 1-2. PM2 설치

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

### 1-3. MariaDB 설치

1. https://mariadb.org/download/ 에서 **MariaDB 12.1** Windows용 MSI Installer 다운로드
2. 설치 중 root 비밀번호 설정 (안전한 비밀번호 — 기록 보관)
3. 포트: **3300** 으로 설정 (기본값 3306에서 변경)
4. 설치 확인:

```powershell
& "C:\Program Files\MariaDB 12.1\bin\mysql.exe" --defaults-file=NUL -u root -p --port=3300 --host=127.0.0.1 -e "SELECT VERSION();"
```

### 1-4. Git 설치

- https://git-scm.com 에서 다운로드 및 설치

---

## 2단계. 데이터베이스 이전

### 2-1. 기존 서버에서 DB 백업

기존 서버 (`10.18.10.70`) 에서 실행:

```powershell
# 백업 폴더 생성
mkdir C:\groupware\backup

# DB 덤프 (my-backup.cnf 사용 — 비밀번호 명령줄 노출 방지)
# C:\groupware\backup\my-backup.cnf 내용:
# [client]
# user=groupware_app
# password=<DB비밀번호>

& "C:\Program Files\MariaDB 12.1\bin\mysqldump.exe" `
  --defaults-file=C:\groupware\backup\my-backup.cnf `
  --single-transaction --host=127.0.0.1 --port=3300 `
  groupware > C:\groupware\backup\groupware_migration.sql
```

파일 `C:\groupware\backup\groupware_migration.sql` 을 새 서버로 복사합니다.

### 2-2. 새 서버에서 DB 및 계정 생성

새 서버에서 root로 실행:

```powershell
& "C:\Program Files\MariaDB 12.1\bin\mysql.exe" --defaults-file=NUL -u root -p --port=3300 --host=127.0.0.1
```

MariaDB 프롬프트에서:

```sql
-- DB 생성
CREATE DATABASE groupware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 전용 계정 생성 (최소권한 — root 미사용)
CREATE USER 'groupware_app'@'localhost' IDENTIFIED BY '새서버용_강력한_비밀번호_여기입력';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON groupware.* TO 'groupware_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> **비밀번호 생성 방법**: PowerShell에서 `openssl rand -hex 48` 실행하거나  
> 임의의 32자 이상 문자열 사용 (대소문자 + 숫자 + 특수문자 조합)

### 2-3. DB 데이터 복원

```powershell
& "C:\Program Files\MariaDB 12.1\bin\mysql.exe" --defaults-file=NUL -u root -p `
  --port=3300 --host=127.0.0.1 groupware < C:\migration\groupware_migration.sql
```

### 2-4. 복원 확인

```powershell
& "C:\Program Files\MariaDB 12.1\bin\mysql.exe" --defaults-file=NUL -u root -p `
  --port=3300 --host=127.0.0.1 groupware `
  -e "SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS docs FROM approval_documents;"
```

---

## 3단계. 코드 배포

```powershell
cd C:\
git clone https://github.com/2015211384dg-ux/groupware.git
```

### 패키지 설치 및 프론트엔드 빌드

```powershell
# 백엔드
cd C:\groupware\backend
npm install --omit=dev

# 프론트엔드
cd C:\groupware\frontend
npm install
npm run build
```

### 업로드 폴더 생성

```powershell
mkdir C:\groupware\backend\uploads
mkdir C:\groupware\backend\uploads\approval
mkdir C:\groupware\logs
```

---

## 4단계. 환경 변수 설정 (.env)

`C:\groupware\backend\.env` 파일을 **새로 생성**합니다.  
기존 서버의 `.env`를 **그대로 복사하지 말고** 아래 항목을 새 서버에 맞게 작성합니다.

```env
# 서버 설정
PORT=5001
NODE_ENV=production

# 데이터베이스 (위에서 생성한 계정)
DB_HOST=localhost
DB_PORT=3300
DB_USER=groupware_app
DB_PASSWORD=새서버용_강력한_비밀번호_여기입력
DB_NAME=groupware

# JWT — 반드시 새로 생성 (기존 값 재사용 금지)
# 생성: powershell에서 openssl rand -hex 64 실행
JWT_SECRET=여기에_128자_랜덤값_입력
JWT_EXPIRES_IN=24h
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=7

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800

# CORS (새 서버 IP로 변경)
CORS_ORIGIN=http://새서버IP:3000

# 세션 — 반드시 새로 생성
# 생성: openssl rand -hex 64
SESSION_SECRET=여기에_128자_랜덤값_입력

# AI 챗봇 (사용하는 경우)
RAG_SERVICE_URL=http://localhost:8001

# 이메일 (기존 서버 값 그대로 사용 가능)
SMTP_USER=메일계정
SMTP_PASS=메일비밀번호
SMTP_FROM_NAME=발신자이름
APP_URL=http://새서버IP:3000
```

### JWT_SECRET / SESSION_SECRET 생성 방법

PowerShell에서:
```powershell
# 1번 실행 → JWT_SECRET에 사용
& openssl rand -hex 64

# 다시 1번 실행 → SESSION_SECRET에 사용
& openssl rand -hex 64
```

> **.env 파일 보안 주의사항**
> - Git에 절대 커밋하지 않습니다 (`.gitignore`에 포함되어 있음)
> - 파일 권한을 관리자 전용으로 설정합니다
> - 별도 안전한 위치(암호화 USB 등)에 보관합니다

### .env 파일 권한 설정

```powershell
# 관리자만 읽기 가능하도록 권한 제한
icacls "C:\groupware\backend\.env" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

---

## 5단계. 백업 설정 (이전에 구성)

```powershell
# 백업 전용 DB 접속 설정 파일 (비밀번호 스크립트 노출 방지)
mkdir C:\groupware\backup
New-Item -Path "C:\groupware\backup\my-backup.cnf" -ItemType File
```

`C:\groupware\backup\my-backup.cnf` 내용:
```ini
[client]
user=groupware_app
password=새서버용_강력한_비밀번호_여기입력
```

```powershell
# 파일 권한 제한
icacls "C:\groupware\backup\my-backup.cnf" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

백업 스크립트 및 스케줄 설정은 **[docs/iso27001/BACKUP-RECOVERY.md](docs/iso27001/BACKUP-RECOVERY.md)** 참조.

---

## 6단계. PM2 실행 및 자동 시작 등록

### ecosystem.config.js 서버 IP 수정

`C:\groupware\ecosystem.config.js` 에서 IP 주소를 새 서버 IP로 변경합니다:

```javascript
// 변경 전
console.log(`🔗 네트워크: http://10.18.10.70:5001`);

// 변경 후 (server.js 내 로그용 — 기능에는 무관)
```

> `ecosystem.config.js` 는 PORT/NODE_ENV 를 이미 올바르게 설정하고 있습니다.

### PM2 시작

```powershell
cd C:\groupware

# ecosystem.config.js 기반으로 모든 프로세스 실행
pm2 start ecosystem.config.js

# 현재 상태 저장
pm2 save

# Windows 재부팅 후 자동 시작 등록 (관리자 권한 PowerShell)
pm2-startup install
pm2 save
```

### 정상 기동 확인

```powershell
pm2 list
# groupware-backend (port 5001) — online
# groupware-frontend (port 3000) — online

pm2 logs groupware-backend --lines 10 --nostream
# ✅ 데이터베이스 연결 성공 이 보여야 함
```

---

## 7단계. 방화벽 설정

**3000 포트만** 인바운드 허용합니다 (5001은 내부용, 3300은 localhost 전용):

```powershell
# 관리자 권한 PowerShell에서 실행
netsh advfirewall firewall add rule `
  name="Groupware-3000-IN" dir=in action=allow protocol=TCP localport=3000
```

이후 사내 모든 PC에서 `http://새서버IP:3000` 으로 접속 가능합니다.

---

## 8단계. 접속 테스트

```powershell
# 서버 헬스체크
Invoke-WebRequest -Uri "http://localhost:5001/health" -UseBasicParsing | Select-Object StatusCode, Content

# 프론트엔드 접속 확인
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing | Select-Object StatusCode
```

다른 PC 브라우저에서 `http://새서버IP:3000` 접속 → 로그인 화면 확인.

---

## 9단계. 자동 배포 설정 (GitHub Actions)

`git push` 만 하면 운영 서버에 자동 반영되도록 설정합니다. [DEV-TO-PROD.md](./DEV-TO-PROD.md) 참조.

---

## 운영 명령어 정리

```powershell
# 상태 확인
pm2 list

# 실시간 로그
pm2 logs groupware-backend

# 에러 로그만
pm2 logs groupware-backend --err

# 재시작 (코드 변경 후)
pm2 restart groupware-backend --update-env

# 프론트엔드 재빌드 후 반영
cd C:\groupware\frontend
npm run build
pm2 restart groupware-backend --update-env

# DB 수동 백업
& "C:\Program Files\MariaDB 12.1\bin\mysqldump.exe" `
  --defaults-file=C:\groupware\backup\my-backup.cnf `
  --single-transaction --host=127.0.0.1 --port=3300 `
  groupware > "C:\groupware\backup\manual_$(Get-Date -Format yyyyMMdd_HHmm).sql"
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 접속 안 됨 | 방화벽 차단 | 3000 포트 인바운드 규칙 확인 |
| 흰 화면 | 프론트 빌드 안 됨 | `npm run build` 후 pm2 restart |
| DB 연결 실패 | MariaDB 꺼짐 또는 .env 오류 | Windows 서비스 관리자에서 MariaDB 확인, .env 재점검 |
| 로그인 안 됨 | JWT_SECRET 불일치 | 기존 서버의 JWT_SECRET 값 확인 후 .env에 동일하게 입력 |
| 쿠키 저장 안 됨 | sameSite/secure 문제 | .env `NODE_ENV=production` 확인, auth.js `secure: false` 유지 |
| 파일 업로드 실패 | uploads 폴더 없음 | `mkdir C:\groupware\backend\uploads\approval` |
| API 응답 없음 | 백엔드 5001 포트 미기동 | `pm2 list` 에서 groupware-backend 상태 확인 |
| 변경사항 안 보임 | 빌드 안 함 | `npm run build` 후 pm2 restart |

---

## 배포 체크리스트

### 최초 배포 (새 서버 세팅)

**소프트웨어 설치**
- [ ] Node.js v22.x 설치 (`node -v` 확인)
- [ ] PM2 + pm2-windows-startup 설치
- [ ] MariaDB 12.1 설치, 포트 3300 설정
- [ ] Git 설치

**DB 이전**
- [ ] 기존 서버에서 `mysqldump` 백업 파일 생성
- [ ] 새 서버에 `groupware` DB 생성
- [ ] `groupware_app` 전용 계정 생성 (최소권한)
- [ ] 백업 파일 복원 및 데이터 건수 확인

**코드 및 설정**
- [ ] `git clone` 으로 코드 다운로드
- [ ] `npm install` (backend, frontend)
- [ ] `npm run build` (frontend)
- [ ] `uploads/`, `uploads/approval/`, `logs/` 폴더 생성
- [ ] `.env` 파일 생성 (JWT_SECRET, SESSION_SECRET 신규 생성)
- [ ] `.env` 파일 권한 제한 (관리자 전용)
- [ ] `my-backup.cnf` 생성 및 권한 제한

**실행 및 검증**
- [ ] `pm2 start ecosystem.config.js`
- [ ] `pm2 save` + `pm2-startup install`
- [ ] 방화벽 3000 포트 인바운드 오픈
- [ ] `pm2 logs groupware-backend` — "✅ 데이터베이스 연결 성공" 확인
- [ ] 다른 PC 브라우저에서 http://새서버IP:3000 접속 및 로그인 테스트
- [ ] 결재문서 작성/승인 테스트
- [ ] 파일 업로드 테스트

**보안 및 백업**
- [ ] 백업 스크립트 (`backup.bat`) 작성 → [BACKUP-RECOVERY.md](docs/iso27001/BACKUP-RECOVERY.md) 참조
- [ ] Windows 작업 스케줄러에 매일 새벽 2시 백업 등록
- [ ] 백업 1회 수동 실행 후 파일 생성 확인
- [ ] GitHub Actions Self-hosted Runner 설치 → [DEV-TO-PROD.md](./DEV-TO-PROD.md) 참조

### 업데이트 배포 시

- [ ] `git pull origin main`
- [ ] 프론트 변경 시 `npm run build`
- [ ] `pm2 restart groupware-backend --update-env`
- [ ] `pm2 logs groupware-backend --lines 20` 오류 없음 확인
