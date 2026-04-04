# 그룹웨어 배포 가이드 (Nginx 리버스 프록시 구성)

> 대상: 도메인 접속 또는 HTTPS 적용이 필요한 경우
> 구성: Windows Server + Node.js + PM2 + MariaDB + Nginx
> 용도: 사내 도메인(`http://groupware.회사명.com`) 또는 HTTPS 운영

---

## 이 문서가 필요한 시점

| 상황 | 필요 여부 |
|------|----------|
| 내부망 IP:포트 접속 (`http://서버IP:3000`) | ❌ 불필요 → [DEPLOYMENT.md](./DEPLOYMENT.md) 참고 |
| 포트 없는 깔끔한 URL (`http://groupware.회사명.com`) | ✅ 이 문서 |
| HTTPS 적용 (`https://groupware.회사명.com`) | ✅ 이 문서 |
| DMZ 또는 외부망 노출 | ✅ 이 문서 |

---

## 전체 구조

```
사내 PC 브라우저
      ↓  (80 또는 443 포트)
   Nginx for Windows       ← 포트 처리 + SSL 인증서 + 리버스 프록시
      ↓  (3000 포트, 내부)
   Node.js + PM2            ← 백엔드 API + 프론트 정적파일 서빙
      ↓  (3300 포트)
   MariaDB                   ← 데이터베이스
```

Node.js(3000)는 외부에 직접 노출하지 않고, Nginx가 80/443을 받아 내부적으로 3000으로 전달합니다.

---

## 1단계. 기본 설정 완료 확인

Nginx를 얹기 전에 기본 구성이 먼저 되어 있어야 합니다.

- [ ] Node.js + PM2 설치
- [ ] MariaDB 설치 및 DB 이전
- [ ] `.env` 설정 완료
- [ ] `pm2 start` 로 백엔드 정상 실행 중
- [ ] `http://서버IP:3000` 접속 확인

기본 구성은 [DEPLOYMENT.md](./DEPLOYMENT.md) 1~5단계를 먼저 완료하세요.

---

## 2단계. Nginx 설치

1. http://nginx.org/en/download.html 에서 **Stable version** 다운로드
2. `C:\nginx` 에 압축 해제 (폴더 구조: `C:\nginx\nginx.exe`)
3. Windows 서비스로 등록 (관리자 권한 PowerShell):

```powershell
sc create nginx binPath="C:\nginx\nginx.exe" start=auto
sc start nginx
```

4. 설치 확인:

```powershell
tasklist | findstr nginx   # nginx.exe 프로세스 확인
```

---

## 3단계. Nginx 설정

`C:\nginx\conf\nginx.conf` 를 아래 내용으로 교체합니다.

### HTTP 전용 (도메인만 연결, HTTPS 없음)

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

    # 파일 업로드 크기 제한 (백엔드 설정과 맞출 것)
    client_max_body_size 50M;

    server {
        listen 80;
        server_name groupware.회사명.com;  # 또는 서버 IP

        # 모든 요청을 Node.js로 전달
        location / {
            proxy_pass         http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection 'upgrade';
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### HTTPS 적용 (사내 인증서 보유 시)

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
    client_max_body_size 50M;

    # HTTP → HTTPS 리다이렉트
    server {
        listen 80;
        server_name groupware.회사명.com;
        return 301 https://$host$request_uri;
    }

    # HTTPS 메인 서버
    server {
        listen 443 ssl;
        server_name groupware.회사명.com;

        ssl_certificate     C:/nginx/ssl/groupware.crt;
        ssl_certificate_key C:/nginx/ssl/groupware.key;

        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        location / {
            proxy_pass         http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection 'upgrade';
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto https;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

> 인증서 파일(`.crt`, `.key`)은 IT팀에서 발급받아 `C:\nginx\ssl\` 에 배치합니다.

---

## 4단계. Nginx 적용 및 재시작

```powershell
cd C:\nginx

# 설정 문법 검사
nginx.exe -t

# 설정 반영 (서비스 재시작 없이)
nginx.exe -s reload

# 또는 서비스 재시작
sc stop nginx
sc start nginx
```

---

## 5단계. .env CORS 설정 수정

Nginx 도입 후에는 요청이 도메인으로 들어오므로 `.env` 의 CORS 설정을 수정합니다.

```env
# 기존 (IP:포트 방식)
CORS_ORIGIN=http://서버IP:3000

# 변경 (도메인 방식)
CORS_ORIGIN=http://groupware.회사명.com

# HTTPS 적용 시
CORS_ORIGIN=https://groupware.회사명.com
```

수정 후 백엔드 재시작:

```powershell
pm2 restart groupware-backend
```

---

## 6단계. 방화벽 설정

```powershell
# HTTP 80포트 허용
netsh advfirewall firewall add rule name="Groupware-HTTP-IN" dir=in action=allow protocol=TCP localport=80

# HTTPS 443포트 허용 (SSL 사용 시)
netsh advfirewall firewall add rule name="Groupware-HTTPS-IN" dir=in action=allow protocol=TCP localport=443

# 3000포트는 Nginx가 내부적으로 사용하므로 외부 차단 유지
# (기존에 3000포트 규칙을 열었다면 삭제)
netsh advfirewall firewall delete rule name="Groupware-3000-IN"
```

---

## 7단계. 사내 DNS 등록

IT팀에 요청:

```
groupware.회사명.com  →  서버 IP
```

등록 후 사내 모든 PC에서 `http://groupware.회사명.com` 으로 접속 가능합니다.

---

## 데스크탑 앱 서버 주소 변경

Nginx 도입 후 데스크탑 앱의 서버 주소도 변경해야 합니다.

앱 트레이 우클릭 → 로그인 화면에서 서버 주소 입력 시:

```
변경 전: http://서버IP:3000
변경 후: http://groupware.회사명.com
```

---

## 운영 명령어

```powershell
# Nginx 상태 확인
tasklist | findstr nginx

# 설정 문법 검사
cd C:\nginx && nginx.exe -t

# 설정 재로드 (무중단)
cd C:\nginx && nginx.exe -s reload

# Nginx 중지 / 시작
sc stop nginx
sc start nginx

# Nginx 로그 확인
type C:\nginx\logs\error.log
type C:\nginx\logs\access.log
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 도메인 접속 안 됨 | DNS 미등록 | IT팀 DNS 등록 요청 |
| 502 Bad Gateway | Node.js 꺼짐 | `pm2 restart groupware-backend` |
| 접속 시 포트 오류 | 방화벽 80 미오픈 | 80포트 인바운드 규칙 추가 |
| CORS 오류 | .env CORS_ORIGIN 미변경 | 도메인으로 수정 후 pm2 restart |
| SSL 인증서 오류 | 인증서 경로 오류 | nginx.conf 경로 재확인 |
| nginx.exe -t 실패 | conf 문법 오류 | 오류 메시지 확인 후 수정 |
| 파일 업로드 실패 (413) | client_max_body_size 미설정 | nginx.conf에서 50M 설정 확인 |

---

## 체크리스트

- [ ] 기본 배포 (DEPLOYMENT.md) 완료 및 동작 확인
- [ ] Nginx 설치 및 서비스 등록
- [ ] nginx.conf 작성 (HTTP 또는 HTTPS 선택)
- [ ] `nginx.exe -t` 문법 검사 통과
- [ ] .env CORS_ORIGIN 도메인으로 변경
- [ ] pm2 restart
- [ ] 방화벽 80포트 오픈 (3000포트 외부 차단)
- [ ] IT팀 DNS 등록 요청
- [ ] 도메인으로 접속 테스트
- [ ] 데스크탑 앱 서버 주소 변경 확인
