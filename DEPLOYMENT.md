# 그룹웨어 서버 배포 가이드 (Windows Server)

> 작성일: 2026-03-24
> 대상: 사내 전용 Windows Server 온프레미스 배포
> 구성: Windows Server + Node.js + PM2 + MySQL + Nginx

---

## 전체 구조

```
사용자 브라우저
      ↓  (80 / 443 포트)
   Nginx for Windows          ← 리버스 프록시 / HTTPS 처리
      ↓  (3000 포트)
   Node.js + PM2              ← 백엔드 API + 프론트 정적파일 서빙
      ↓  (3300 포트)
   MySQL                      ← 데이터베이스
```

---

## 1단계. 서버 PC 준비

### 권장 사양
| 항목 | 최소 | 권장 |
|------|------|------|
| OS | Windows 10 Pro | Windows Server 2019/2022 |
| CPU | 2코어 | 4코어 이상 |
| RAM | 4GB | 8GB 이상 |
| 저장소 | 50GB | 100GB 이상 (업로드 파일 고려) |
| 네트워크 | 사내 고정 IP 필수 | 유선 연결 권장 |

### 고정 IP 설정
- 서버 PC에 사내 고정 IP 할당 (예: `192.168.1.100`)
- IT팀 또는 공유기 DHCP 예약으로 설정
- 현재 이 PC IP: `10.18.10.78`

---

## 2단계. 필수 소프트웨어 설치

### 2-1. Node.js 설치
1. https://nodejs.org 에서 **LTS 버전** 다운로드
2. 설치 시 "Add to PATH" 옵션 체크
3. 설치 확인:
```powershell
node -v   # v18.x.x 이상
npm -v
```

### 2-2. PM2 설치
```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

### 2-3. MySQL 설치
1. https://dev.mysql.com/downloads/installer/ 에서 MySQL Installer 다운로드
2. **MySQL Server** + **MySQL Workbench** 선택 설치
3. 설치 중 root 비밀번호 설정 (현재: `Amphenol123`)
4. 포트: **3300** (기본 3306과 다름 — 설치 시 직접 입력)
5. 설치 확인:
```powershell
mysql -u root -p -P 3300
```

### 2-4. Nginx for Windows 설치
1. http://nginx.org/en/download.html 에서 **Stable version** 다운로드
2. `C:\nginx` 에 압축 해제
3. 서비스 등록 (자동 실행):
```powershell
# 관리자 권한 PowerShell에서 실행
sc create nginx binPath="C:\nginx\nginx.exe" start=auto
sc start nginx
```

### 2-5. Git 설치 (선택, 코드 배포용)
1. https://git-scm.com 에서 다운로드 및 설치

---

## 3단계. 데이터베이스 설정

### 3-1. 기존 서버에서 DB 내보내기 (현재 PC에서 실행)
```powershell
# 현재 PC에서 DB 백업
mysqldump -u root -p -P 3300 groupware > groupware_backup.sql
```

### 3-2. 새 서버에 DB 가져오기 (새 서버에서 실행)
```powershell
# MySQL 접속
mysql -u root -p -P 3300

# DB 생성
CREATE DATABASE groupware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 백업 파일 가져오기
mysql -u root -p -P 3300 groupware < groupware_backup.sql
```

### 3-3. DB 사용자 생성 (보안 강화)
```sql
-- root 대신 전용 사용자 생성 권장
CREATE USER 'groupware_user'@'localhost' IDENTIFIED BY '강력한비밀번호';
GRANT ALL PRIVILEGES ON groupware.* TO 'groupware_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## 4단계. 프로젝트 코드 배포

### 4-1. 코드 복사
**방법 A: Git 사용 (권장)**
```powershell
cd C:\
git clone https://github.com/회사저장소/groupware.git
```

**방법 B: 직접 복사**
- 현재 `C:\groupware` 폴더를 새 서버의 `C:\groupware` 에 복사

### 4-2. 백엔드 패키지 설치
```powershell
cd C:\groupware\backend
npm install --production
```

### 4-3. 프론트엔드 빌드
```powershell
cd C:\groupware\frontend
npm install
npm run build
```
빌드 결과물: `C:\groupware\frontend\dist\`
백엔드가 이 폴더를 자동으로 서빙합니다.

---

## 5단계. 환경 변수 설정

`C:\groupware\backend\.env` 파일 생성/수정:

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

# CORS (실제 서버 IP 또는 도메인으로 변경)
CORS_ORIGIN=http://groupware.회사명.com,http://192.168.1.100

# 세션
SESSION_SECRET=새로운랜덤세션시크릿
```

> **보안 주의**: `.env` 파일은 외부 공개 금지. Git에 올리지 않도록 `.gitignore`에 포함되어 있는지 확인.

---

## 6단계. PM2로 백엔드 실행

### 6-1. 첫 실행
```powershell
cd C:\groupware\backend
pm2 start server.js --name groupware-backend
pm2 save
```

### 6-2. Windows 시작 시 자동 실행 등록
```powershell
# 관리자 권한 PowerShell에서
pm2-startup install
pm2 save
```

### 6-3. 상태 확인
```powershell
pm2 list
pm2 logs groupware-backend
```

---

## 7단계. Nginx 설정 (리버스 프록시)

`C:\nginx\conf\nginx.conf` 수정:

```nginx
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout  65;

    # 파일 업로드 크기 제한 (50MB)
    client_max_body_size 50M;

    server {
        listen 80;
        server_name groupware.회사명.com;  # 또는 192.168.1.100

        # Node.js 앱으로 프록시
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### Nginx 재시작
```powershell
cd C:\nginx
nginx.exe -t          # 설정 문법 검사
nginx.exe -s reload   # 재시작
```

---

## 8단계. 방화벽 설정

관리자 권한 PowerShell에서:

```powershell
# HTTP (80포트) 허용
netsh advfirewall firewall add rule name="Groupware-HTTP-IN" dir=in action=allow protocol=TCP localport=80

# HTTPS (443포트) 허용 - SSL 사용 시
netsh advfirewall firewall add rule name="Groupware-HTTPS-IN" dir=in action=allow protocol=TCP localport=443

# 3000포트는 Nginx가 프록시하므로 외부 차단 (내부만 허용)
# 별도 규칙 불필요 — 0.0.0.0 바인딩이지만 Nginx가 80으로 받아줌
```

---

## 9단계. 사내 도메인 연결

IT팀에 DNS 등록 요청:
```
groupware.회사명.com  →  서버 IP (예: 192.168.1.100)
```

등록 후 사내 모든 PC에서 `http://groupware.회사명.com` 으로 접속 가능.

---

## 10단계. HTTPS 설정 (선택)

### 사내 인증서가 있는 경우
IT팀에서 발급받은 `.crt`, `.key` 파일을 `C:\nginx\ssl\` 에 배치:

```nginx
server {
    listen 443 ssl;
    server_name groupware.회사명.com;

    ssl_certificate     C:/nginx/ssl/groupware.crt;
    ssl_certificate_key C:/nginx/ssl/groupware.key;

    location / {
        proxy_pass http://localhost:3000;
        ...
    }
}

# HTTP → HTTPS 자동 리다이렉트
server {
    listen 80;
    server_name groupware.회사명.com;
    return 301 https://$host$request_uri;
}
```

---

## 배포 후 업데이트 방법

### 코드 수정 후 배포 절차

```powershell
# 1. 새 코드 받기 (Git 사용 시)
cd C:\groupware
git pull

# 2. 프론트엔드가 바뀐 경우
cd C:\groupware\frontend
npm run build

# 3. 백엔드 재시작
pm2 restart groupware-backend

# 4. 브라우저에서 Ctrl+Shift+R 강제 새로고침
```

### 백엔드만 바뀐 경우
```powershell
pm2 restart groupware-backend
```

---

## 운영 중 유용한 명령어

```powershell
# 서버 상태 확인
pm2 list

# 실시간 로그 보기
pm2 logs groupware-backend

# 에러 로그만 보기
pm2 logs groupware-backend --err

# 서버 재시작
pm2 restart groupware-backend

# DB 백업 (정기적으로 실행 권장)
mysqldump -u root -p -P 3300 groupware > C:\backup\groupware_%date%.sql

# Nginx 상태 확인
tasklist | findstr nginx
```

---

## 정기 백업 설정 (작업 스케줄러)

1. Windows **작업 스케줄러** 열기
2. 새 작업 만들기
3. 트리거: 매일 새벽 3시
4. 동작: 아래 스크립트 실행

```powershell
# C:\scripts\backup.ps1
$date = Get-Date -Format "yyyyMMdd"
$backupDir = "C:\backup"

# DB 백업
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" `
  -u root -pAmphenol123 -P 3300 groupware > "$backupDir\db_$date.sql"

# 30일 이상 된 백업 삭제
Get-ChildItem $backupDir -Filter "*.sql" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 접속 안 됨 | 방화벽 차단 | 80포트 인바운드 규칙 확인 |
| 502 Bad Gateway | Node.js 꺼짐 | `pm2 restart groupware-backend` |
| DB 연결 실패 | MySQL 꺼짐 또는 .env 오류 | MySQL 서비스 확인, .env 재확인 |
| 로그인 안 됨 | JWT_SECRET 변경됨 | 기존 .env의 JWT_SECRET 그대로 사용 |
| 파일 업로드 실패 | uploads 폴더 없음 | `mkdir C:\groupware\backend\uploads` |
| 변경사항 안 보임 | 빌드 안 함 | `npm run build` 후 pm2 restart |

---

## 체크리스트

### 최초 배포 시
- [ ] Node.js 설치 확인
- [ ] MySQL 설치 및 DB 생성
- [ ] DB 데이터 이전 (기존 서버에서 dump)
- [ ] 코드 복사 및 패키지 설치
- [ ] `.env` 파일 생성 및 설정
- [ ] 프론트엔드 빌드 (`npm run build`)
- [ ] PM2로 백엔드 실행
- [ ] PM2 자동 시작 등록
- [ ] Nginx 설치 및 설정
- [ ] 방화벽 80포트 오픈
- [ ] 사내 DNS 등록 요청
- [ ] 접속 테스트 (다른 PC에서)
- [ ] 정기 백업 스케줄 등록

### 업데이트 배포 시
- [ ] 코드 수정 완료
- [ ] 프론트 변경 시 `npm run build`
- [ ] `pm2 restart groupware-backend`
- [ ] 정상 동작 확인
