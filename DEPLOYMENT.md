# 그룹웨어 배포 가이드 (내부망 · Node.js 단독 구성)

> 대상: 사내 전용 Windows Server 온프레미스 배포
> 구성: Windows Server + Node.js + PM2 + MariaDB
> 용도: 내부망 전용, HTTP 운영 (HTTPS·Nginx 불필요)

---

## 전체 구조

```
사내 PC 브라우저
      ↓  (3000 포트)
   Node.js + PM2       ← 백엔드 API + 프론트 정적파일 서빙
      ↓  (3300 포트)
   MariaDB              ← 데이터베이스
```

> Nginx 없이 Node.js가 직접 80→3000 포트로 서비스합니다.
> HTTPS 또는 도메인 연결이 필요해지면 [DEPLOYMENT-NGINX.md](./DEPLOYMENT-NGINX.md)를 참고하세요.

---

## 권장 서버 사양

| 항목 | 최소 | 권장 |
|------|------|------|
| OS | Windows 10 Pro | Windows Server 2019/2022 |
| CPU | 2코어 | 4코어 이상 |
| RAM | 4GB | 8GB 이상 |
| 저장소 | 50GB | 100GB 이상 (업로드 파일 고려) |
| 네트워크 | 사내 고정 IP 필수 | 유선 연결 권장 |

---

## 1단계. 필수 소프트웨어 설치

### 1-1. Node.js 설치

1. https://nodejs.org 에서 **LTS 버전** 다운로드
2. 설치 시 "Add to PATH" 옵션 체크
3. 설치 확인:

```powershell
node -v   # v18.x.x 이상
npm -v
```

### 1-2. PM2 설치

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

### 1-3. MariaDB 설치

1. https://mariadb.org/download/ 에서 Windows용 MSI Installer 다운로드
2. 설치 중 root 비밀번호 설정
3. 포트: **3300** 으로 설정 (설치 화면에서 직접 입력)
4. 설치 확인:

```powershell
mariadb -u root -p -P 3300
```

### 1-4. Git 설치 (선택, 코드 배포용)

- https://git-scm.com 에서 다운로드 및 설치

---

## 2단계. 데이터베이스 이전

### 2-1. 기존 서버에서 DB 백업

```powershell
mysqldump -u root -p -P 3300 groupware > C:\backup\groupware_backup.sql
```

### 2-2. 새 서버에서 DB 복원

```powershell
# MariaDB 접속
mariadb -u root -p -P 3300

# DB 생성
CREATE DATABASE groupware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 백업 파일 가져오기
mariadb -u root -p -P 3300 groupware < C:\backup\groupware_backup.sql
```

### 2-3. DB 전용 계정 생성 (보안 권장)

```sql
CREATE USER 'groupware_user'@'localhost' IDENTIFIED BY '강력한비밀번호';
GRANT ALL PRIVILEGES ON groupware.* TO 'groupware_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## 3단계. 프로젝트 코드 배포

### 방법 A: Git clone (권장)

```powershell
cd C:\
git clone https://github.com/2015211384dg-ux/groupware.git
```

### 방법 B: 직접 복사

현재 `C:\groupware` 폴더를 새 서버의 `C:\groupware` 에 복사

### 패키지 설치 및 프론트엔드 빌드

```powershell
# 백엔드 패키지
cd C:\groupware\backend
npm install --production

# 프론트엔드 빌드
cd C:\groupware\frontend
npm install
npm run build
```

빌드 결과물(`frontend/dist/`)은 백엔드가 자동으로 서빙합니다.

---

## 4단계. 환경 변수 설정

`C:\groupware\backend\.env` 파일 생성:

```env
# 서버 설정
PORT=3000
NODE_ENV=production

# 데이터베이스
DB_HOST=localhost
DB_PORT=3300
DB_USER=groupware_user
DB_PASSWORD=강력한비밀번호
DB_NAME=groupware

# JWT (반드시 새로 생성할 것)
JWT_SECRET=새로운랜덤문자열64자이상
JWT_EXPIRES_IN=24h
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=7

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800

# CORS (서버 IP로 변경)
CORS_ORIGIN=http://서버IP:3000
```

> **주의**: `.env` 파일은 절대 Git에 올리지 않습니다. `.gitignore`에 포함되어 있습니다.

---

## 5단계. PM2로 백엔드 실행

```powershell
cd C:\groupware\backend

# 첫 실행
pm2 start server.js --name groupware-backend
pm2 save

# Windows 시작 시 자동 실행 등록 (관리자 권한 PowerShell)
pm2-startup install
pm2 save
```

---

## 6단계. 방화벽 설정

```powershell
# 3000포트 인바운드 허용
netsh advfirewall firewall add rule name="Groupware-3000-IN" dir=in action=allow protocol=TCP localport=3000
```

이후 사내 모든 PC에서 `http://서버IP:3000` 으로 접속 가능합니다.

---

## 배포 후 업데이트

```powershell
# 1. 코드 최신화 (Git 사용 시)
cd C:\groupware
git pull

# 2. 프론트엔드가 바뀐 경우
cd C:\groupware\frontend
npm run build

# 3. 백엔드 재시작
pm2 restart groupware-backend
```

---

## 자동 배포 (GitHub Actions + Self-hosted Runner)

`git push` 만 하면 운영 서버에 자동 반영되도록 설정합니다.

### 전체 흐름

```
개발 PC에서 git push
      ↓
GitHub Actions 트리거
      ↓
운영 서버의 Runner가 감지
      ↓
git pull + 프론트 빌드 + pm2 restart 자동 실행
```

### Runner 설치 (운영 서버에서 1회)

1. GitHub 저장소 → **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. OS: **Windows** 선택 후 안내 명령어 실행
3. 서비스 등록:

```powershell
.\svc.cmd install
.\svc.cmd start
```

### 워크플로우 파일 생성

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - name: 코드 최신화
        run: git pull origin main

      - name: 프론트엔드 빌드
        run: |
          cd frontend
          npm install
          npm run build

      - name: 백엔드 재시작
        run: pm2 restart groupware-backend
```

---

## 정기 백업 설정 (작업 스케줄러)

`C:\scripts\backup.ps1`:

```powershell
$date = Get-Date -Format "yyyyMMdd"
$backupDir = "C:\backup"

# DB 백업
& "C:\Program Files\MariaDB\MariaDB Server\bin\mariadb-dump.exe" `
  -u groupware_user -p강력한비밀번호 -P 3300 groupware > "$backupDir\db_$date.sql"

# 30일 이상 된 백업 삭제
Get-ChildItem $backupDir -Filter "*.sql" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item
```

Windows 작업 스케줄러에서 매일 새벽 3시 실행으로 등록합니다.

---

## 유용한 운영 명령어

```powershell
# 서버 상태 확인
pm2 list

# 실시간 로그
pm2 logs groupware-backend

# 에러 로그만
pm2 logs groupware-backend --err

# 서버 재시작
pm2 restart groupware-backend

# DB 즉시 백업
mysqldump -u root -p -P 3300 groupware > C:\backup\groupware_manual.sql
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 접속 안 됨 | 방화벽 차단 | 3000포트 인바운드 규칙 확인 |
| 페이지 흰 화면 | 프론트 빌드 안 됨 | `npm run build` 후 pm2 restart |
| DB 연결 실패 | MariaDB 꺼짐 또는 .env 오류 | MariaDB 서비스 확인, .env 재점검 |
| 로그인 안 됨 | JWT_SECRET 변경됨 | 기존 .env의 JWT_SECRET 그대로 유지 |
| 파일 업로드 실패 | uploads 폴더 없음 | `mkdir C:\groupware\backend\uploads` |
| 변경사항 안 보임 | 빌드 안 함 | `npm run build` 후 pm2 restart |

---

## 배포 체크리스트

### 최초 배포 시

- [ ] Node.js 설치 확인 (`node -v`)
- [ ] PM2 설치 확인 (`pm2 -v`)
- [ ] MariaDB 설치 및 포트 3300 확인
- [ ] DB 생성 및 데이터 이전
- [ ] 코드 복사 (`git clone` 또는 폴더 복사)
- [ ] `npm install` (backend / frontend)
- [ ] 프론트엔드 빌드 (`npm run build`)
- [ ] `.env` 파일 생성 및 설정
- [ ] PM2 실행 및 자동 시작 등록
- [ ] 방화벽 3000포트 오픈
- [ ] 다른 PC에서 접속 테스트
- [ ] 정기 백업 스케줄 등록

### 업데이트 배포 시

- [ ] `git pull`
- [ ] 프론트 변경 시 `npm run build`
- [ ] `pm2 restart groupware-backend`
- [ ] 정상 동작 확인
