# 서버 이전 가이드 (기존 PC → 새 서버)

> 이 문서 하나만 보고 새 서버 세팅을 처음부터 끝까지 완료할 수 있습니다.  
> **0단계의 변수 4개만 채우면** 이후 모든 명령을 그대로 복사해서 실행 가능합니다.

---

## AI 어시스턴트용 프로젝트 컨텍스트

> 이 섹션은 새 서버에서 Claude Code 등 AI 어시스턴트를 처음 실행할 때 프로젝트를 빠르게 파악하기 위한 요약입니다.

### 프로젝트 개요

**사내 그룹웨어** — Node.js/Express(백엔드) + React/Vite(프론트엔드) + MariaDB(port 3300)

- 코드 위치: `C:\groupware`
- GitHub: https://github.com/2015211384dg-ux/groupware (main 브랜치)
- 사용자 접속: `http://[서버IP]:3000` (Vite dev server가 프론트 서빙 + `/api/v1/*` → port 5001 프록시)
- DB 포트: **3300** (기본 3306 아님 — 주의)

### PM2 프로세스 구조 (ecosystem.config.js)

| PM2 이름 | 포트 | 역할 |
|----------|------|------|
| `groupware-backend` | 5001 | Node.js/Express API 서버 (NODE_ENV=production) |
| `groupware-frontend` | 3000 | Vite dev server (`--port 3000 --host`) — 사용자 진입점 |
| `rag-service` | 8001 | Python FastAPI — AI 챗봇 RAG 파이프라인 (`rag_service/main.py`) |

> Vite가 `/api/v1/*` 요청을 `http://localhost:5001`로 프록시합니다 (`vite.config.js` proxy 설정).

### 전체 기능 목록

| 기능 | 백엔드 라우트 | 프론트 페이지 | 비고 |
|------|--------------|--------------|------|
| 인증 (JWT + refresh) | `routes/auth.js` | `pages/Login.js` | httpOnly 쿠키, 15분/7일 |
| 매직링크 로그인 | `routes/auth.js` | `pages/MagicLogin.js` | 1회용 토큰 |
| 강제 비밀번호 변경 | `routes/users.js` | `components/common/ForcePasswordChange.js` | 로그인 후 오버레이 |
| 게시판 | `routes/posts.js`, `routes/boards.js`, `routes/comments.js`, `routes/attachments.js` | `pages/PostList.js`, `PostDetail.js`, `PostWrite.js` | 게시글 고정(is_pinned), 댓글, 첨부파일 |
| 전체 검색 | `routes/search.js` | `pages/Search.js` | 게시글·사용자·결재 통합 |
| 전자결재 | `routes/approval.js`, `routes/approvalAdmin.js` | `pages/Approval.js`, `ApprovalWrite.js`, `ApprovalDetail.js` | 서식 빌더, 결재선, 승인/반려, 메일 발송 |
| 결재 관리자 | `routes/approvalAdmin.js` | `pages/ApprovalAdmin.js` | 서식 관리, 전체 문서 조회 |
| 주소록 (전체/조직도) | `routes/addressbook.js` | `pages/Organization.js`, `AddressBook.js` | 트리형/카드형 조직도, 팀 리더 |
| 개인 주소록 | `routes/addressbook.js` | `pages/PersonalContacts.js` | 즐겨찾기, 그룹 관리 |
| HR (내 정보) | `routes/hr.js` | `pages/MyInfo.js` | 프로필 조회·수정 |
| 캘린더 | `routes/events.js` | `pages/Calendar.js` | 개인/공유 이벤트 |
| 예산관리 AR | `routes/ar.js` | `pages/AR.js` | 프로젝트별 예산·지출, 가계부 스타일 대시보드 |
| AR 관리자 | `routes/ar.js` | `pages/ARAdmin.js` | 전체 프로젝트 관리 |
| AI 전표 자동화 | `routes/voucher.js` | `pages/VoucherAI.js` | PDF 텍스트 추출 + Ollama 로컬 LLM |
| 프로젝트 관리 | `routes/projects.js` | `pages/ProjectHub.js`, `ProjectDetail.js` | 업무 탭(간트/캘린더/인사이트) + 피드 탭 |
| AI 챗봇 | `routes/chatbot.js` | `pages/Chatbot.js`, `ChatbotWidget.js` | RAG 파이프라인 (rag-service Python) |
| 챗봇 관리자 | `routes/chatbot.js` | `pages/ChatbotAdmin.js` | 문서 업로드, 인덱스 관리 |
| 피드백 | `routes/feedback.js` | `pages/Feedback.js` | 사용자 의견 제출 |
| 피드백 관리자 | `routes/feedback.js` | `pages/FeedbackAdmin.js` | 답변 처리 |
| 알림 (인앱 벨) | `routes/notifications.js`, `routes/approval.js` | `components/Layout/Header.js` | 30초 폴링, 결재·게시글·댓글·AR |
| 새 댓글 알림 목록 | `routes/dashboard.js` | `pages/MyComments.js` | 내 글에 달린 새 댓글 목록 |
| 대시보드 | `routes/dashboard.js` | `pages/Dashboard.js` | 통계 셀 클릭 → 상세 화면 이동 |
| 팝업 공지 | `routes/settings.js` | `components/common/PopupNotice.js` | 관리자 설정, 로그인 후 표시 |
| 점검 모드 | `routes/settings.js` | `pages/MaintenancePage.js` | ON 시 일반 사용자 차단, 30초 폴링 |
| 시스템 설정 | `routes/settings.js` | `pages/Settings.js` | 사이트명, 세션 타임아웃, 점검 모드 등 |
| 사용자 관리 | `routes/users.js` | `pages/UserManagement.js` | 등록/수정/잠금/비밀번호 이력 |
| 부서 관리 | `routes/departments.js` | `pages/DepartmentManagement.js` | 부서 CRUD, 팀 리더 지정 |
| 접근권한 검토 | `routes/accessReview.js` | `pages/AccessReview.js` | ISO 27001 반기 검토 (SUPER_ADMIN) |
| 에러 수집 | `routes/clientLogs.js` | `utils/errorReporter.js`, `components/common/ErrorBoundary.jsx` | JS/API 오류 → system_logs |
| 데스크탑 앱 | — | `desktop/main.js` | Electron, 15초 폴링 → 토스트 팝업 |

### DB 전체 테이블

```
# 인증·사용자
users                    — 계정 (role: USER/DEPT_ADMIN/HR_ADMIN/SUPER_ADMIN, require_password_change)
employees                — 직원 상세 (부서/직급/연락처, users와 1:1)
departments              — 부서 (leader_id FK→employees)
refresh_tokens           — JWT refresh 토큰
password_history         — 비밀번호 이력 (최근 3개 재사용 차단, 10개 보관)
magic_links              — 매직링크 1회용 토큰

# 게시판
boards                   — 게시판 정의 (name, description)
posts                    — 게시글 (is_pinned, is_notice)
post_views               — 게시글 열람 기록 (사용자별)
comments                 — 게시글 댓글
comment_checks           — 댓글 확인 기록 (새 댓글 탐지용)
attachments              — 게시글 첨부파일

# 캘린더
calendar_events          — 캘린더 이벤트

# 주소록
personal_contacts        — 개인 주소록
personal_contact_groups  — 개인 주소록 그룹

# 전자결재
approval_documents       — 결재문서 (status: draft/pending/approved/rejected)
approval_forms           — 결재 서식 (form_fields JSON 배열)
approval_lines           — 결재선 (결재자 순서)
approval_steps           — 결재 단계별 처리 이력
approval_notifications   — 결재 알림 + AR 팀 배정 알림 (document_id nullable, url, type)

# 예산관리 AR
ar_projects              — AR 프로젝트 (예산, 상태)
ar_expenses              — 지출 내역
ar_project_teams         — 프로젝트 열람 팀 (재경팀 id=4 자동 포함)
ar_activity_logs         — AR 활동 히스토리

# 프로젝트 관리
projects                 — 프로젝트
project_members          — 프로젝트 멤버
task_groups              — 업무 그룹
tasks                    — 업무 (status, priority, progress, dates)
task_assignees           — 업무 담당자
task_comments            — 업무 댓글
project_activity_logs    — 프로젝트 활동 로그
project_feeds            — 피드 탭 게시물
feed_attachments         — 피드 첨부파일
feed_comments            — 피드 댓글

# 알림·피드백
notifications            — 게시글·댓글·피드백·AR 80% 경고 알림
feedback                 — 사용자 피드백
popup_notices            — 팝업 공지 (활성 기간 설정)

# 시스템·보안
system_settings          — 전역 설정 (사이트명, 세션 타임아웃, 점검 모드, 팝업 공지 등)
system_logs              — 서버/클라이언트 오류, 이메일 발송 결과 (90일 자동 삭제)
audit_logs               — 민감 데이터 접근 로그
access_reviews           — 접근권한 반기 검토 (ISO 27001)
access_review_items      — 검토 항목별 처리 결과
```

> **재경팀 `department_id = 4`** — AR 프로젝트 권한에 하드코딩. DB 변경 시 `ar.js` 코드도 함께 수정 필요.

### 핵심 아키텍처 패턴

**인증·보안**
- httpOnly 쿠키 (accessToken 15분 + refreshToken 7일)
- Axios 인터셉터: 401 → `/auth/refresh` 자동 시도, 실패 시 `/login` 리디렉트
- 로그인 실패 N회 → 계정 잠금 (`users.failed_login_count`)
- 비밀번호 이력 검사: `utils/logger.js` `checkPasswordHistory()` — 최근 3개 재사용 차단
- CSRF 쿠키 플래그, CSP 헤더 (`helmet`), 감사 로그 (`audit_logs`)
- Rate limit: 전체 API 3000/15분, 내부망 IP(10.x.x.x, 192.168.x.x) 면제, 클라이언트 로그 20/분

**파일·미디어**
- 업로드: `multer` → `backend/uploads/` 하위 폴더 (approval/, characters/ 등)
- `/uploads/*` 공개 접근 (인증 불필요) — 아바타, 결재 첨부, AI 결과물
- 아바타: `uploads/characters/` 20개 캐릭터, 신규 사용자 랜덤 배정

**로깅**
- `backend/utils/logger.js` → `logActivity(type, message, {userId, req})` → system_logs INSERT
- 클라이언트 오류: `frontend/src/utils/errorReporter.js` → `POST /api/v1/logs/client-error` (5초 dedup)
- React 렌더 오류: `ErrorBoundary.jsx` → `componentDidCatch` → reportClientError
- Axios 응답 인터셉터: 5xx → reportClientError 자동 호출
- 이메일: `sendMailWithLog(fn, ctx)` — fire-and-forget + 성공/실패 system_logs 기록

**자동 정리 (server.js)**
- `refresh_tokens` 만료 항목: 1시간마다 삭제 (`setInterval`)
- `system_logs` 90일 이상: 매일 새벽 3시 삭제 (`scheduleDailyCleanup`)
- 모든 테이블: 서버 시작 시 `initDB()` 자동 생성 (없으면 CREATE TABLE IF NOT EXISTS)

**캐시**
- `cacheMiddleware(ttl)`: 일부 라우트(조직도 제외)에 1분 메모리 캐시 적용

**UI 규칙 (피드백으로 확정된 규칙 — 반드시 준수)**
- 이모지 사용 금지 → 인라인 SVG로 대체 (`stroke="#667eea"` 주색)
- `border-left` 색띠 카드 장식 금지
- 버튼 배경: 그라디언트 → `#667eea` solid 단색
- `text-transform: uppercase` 금지
- 터치 타겟 최소 36px
- username 허용 문자: `/^[a-zA-Z0-9_.]+$/` (영문·숫자·밑줄·점)

**점검 모드**
- `system_settings.maintenance = 1` → 미들웨어가 API 503 반환 (15초 캐시)
- 관리자 아닌 사용자는 `MaintenancePage` 렌더 (App.js 30초 폴링)
- 화이트리스트: `/auth/login`, `/auth/me`, `/auth/refresh`, `/settings/public`, `/settings/maintenance`

**세션 타임아웃**
- App.js 유휴 타이머: 기본 60분, `system_settings.session_timeout`으로 조정
- `Settings.js` 관리자 페이지에서 변경 가능

### 자주 쓰는 PM2 명령

```powershell
pm2 list                                     # 전체 상태 (backend/frontend/rag-service)
pm2 logs groupware-backend --lines 50        # 백엔드 로그
pm2 logs rag-service --lines 30              # RAG 서비스 로그
pm2 restart groupware-backend --update-env   # .env 변경 후 재시작
pm2 flush                                    # 로그 초기화
pm2 save                                     # 현재 프로세스 상태 저장 (재부팅 대비)
```

### 2026-04-29 기준 최근 추가된 기능

1. **에러 로깅 시스템**: 클라이언트 JS·5xx API 오류 → system_logs 자동 기록
2. **이메일 발송 로그**: 결재 메일 성공/실패 → system_logs (`sendMailWithLog`)
3. **결재 PUT 라우트 메일 누락 수정**: 초안 수정 후 재상신 시에도 메일 발송
4. **전자결재 내용 라벨**: 서식 `form_fields`에 content 필드 있으면 '비고', 없으면 '내용'으로 동적 분기
5. **username 점(.) 허용**: 정규식 업데이트 (백엔드 `users.js` + 프론트 `UserModal.js`)

---

---

## 사전 준비

- 새 서버 PC 준비 (Windows 10 Pro / Server 2019 이상)
- 새 서버에 사내 고정 IP 할당
- 인터넷 연결 가능한 상태 (설치 중에만 필요)
- USB 또는 공유 폴더로 기존 서버 → 새 서버 파일 복사 가능한 환경

---

## 0단계. 이 문서에서 사용할 변수 설정

새 서버의 PowerShell을 **관리자 권한**으로 열고 아래 4줄을 먼저 실행합니다.  
`[대괄호 안]` 값만 실제 값으로 바꾸면 됩니다.

```powershell
# ① 새 서버 IP (예: 10.18.10.100)
$NEW_IP = "[새_서버_IP]"

# ② 새 서버 MariaDB root 비밀번호 (설치 시 설정할 비밀번호 — 미리 정해두기)
$ROOT_PW = "[MariaDB_root_비밀번호]"

# ③ groupware_app 계정 비밀번호 (아래 명령으로 자동 생성 권장)
$DB_PW = -join ((65..90) + (97..122) + (48..57) + (33,35,36,37,38,42,43,45) |
    Get-Random -Count 48 | ForEach-Object { [char]$_ })
Write-Host "DB 비밀번호 (기록해두세요):" $DB_PW

# ④ JWT/세션 시크릿 2개 생성
$JWT_SECRET     = -join ((48..57) + (65..70) + (97..102) | Get-Random -Count 128 | ForEach-Object { [char]$_ })
$SESSION_SECRET = -join ((48..57) + (65..70) + (97..102) | Get-Random -Count 128 | ForEach-Object { [char]$_ })
Write-Host "JWT_SECRET (기록해두세요):" $JWT_SECRET
Write-Host "SESSION_SECRET (기록해두세요):" $SESSION_SECRET
```

> **지금 생성된 $DB_PW, $JWT_SECRET, $SESSION_SECRET 값을 메모장에 복사해 두세요.**  
> 뒤에서 .env 파일 작성 시 사용합니다.

---

## 1단계. 기존 서버에서 DB 백업 받기

**기존 서버 (10.18.10.70)** 에서 실행합니다.

```powershell
# 백업 폴더 생성
mkdir C:\groupware\backup -Force

# DB 전체 덤프
& "C:\Program Files\MariaDB 12.1\bin\mysqldump.exe" `
    --defaults-file=C:\groupware\backup\my-backup.cnf `
    --single-transaction --host=127.0.0.1 --port=3300 `
    groupware > C:\groupware\backup\groupware_migration.sql

# 파일 크기 확인 (0KB면 오류)
(Get-Item C:\groupware\backup\groupware_migration.sql).Length / 1KB
```

> `my-backup.cnf` 가 없으면 root 계정으로 실행:
> ```powershell
> $tmp = New-TemporaryFile
> & "C:\Program Files\MariaDB 12.1\bin\mysqldump.exe" `
>     --defaults-file=$tmp `
>     -u root -p[root_비밀번호] --host=127.0.0.1 --port=3300 `
>     groupware > C:\groupware\backup\groupware_migration.sql
> ```

**업로드 파일도 함께 복사합니다.**

```powershell
# uploads 폴더를 ZIP으로 묶기
Compress-Archive -Path C:\groupware\backend\uploads `
    -DestinationPath C:\groupware\backup\uploads_migration.zip -Force
```

이제 `C:\groupware\backup\groupware_migration.sql` 과  
`C:\groupware\backup\uploads_migration.zip` 을  
**USB 또는 공유 폴더로 새 서버로 복사합니다.**

---

## 2단계. 소프트웨어 설치 (새 서버)

이하 모든 작업은 **새 서버의 관리자 권한 PowerShell**에서 실행합니다.

### 2-1. Node.js v22 LTS 설치

브라우저에서 https://nodejs.org → LTS 버전 다운로드 후 설치  
(설치 옵션: "Add to PATH" 반드시 체크)

설치 후 PowerShell **재시작** 후 확인:
```powershell
node -v   # v22.x.x 이상이어야 함
npm -v    # 10.x.x 이상
```

### 2-2. PM2 설치

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2 -v    # 설치 확인
```

### 2-3. Git 설치

브라우저에서 https://git-scm.com → 다운로드 후 설치 (기본값으로 설치)

```powershell
git -v    # 설치 확인
```

### 2-4. MariaDB 12.1 설치

브라우저에서 https://mariadb.org/download/ → **MariaDB 12.1** Windows MSI 다운로드 후 설치

설치 화면에서:
- **root 비밀번호**: 0단계에서 정한 `$ROOT_PW` 값 입력
- **포트**: `3306` → **`3300`** 으로 변경 (중요!)
- "Install as service" 체크

설치 후 확인:
```powershell
# PowerShell 재시작 후 (0단계 변수 재설정 필요)
$tmp = New-TemporaryFile
& "C:\Program Files\MariaDB 12.1\bin\mysql.exe" --defaults-file=$tmp `
    -u root -p$ROOT_PW --host=127.0.0.1 --port=3300 -e "SELECT VERSION();"
# 12.1.x-MariaDB 가 출력되어야 함
```

---

## 3단계. DB 생성 및 계정 설정 (새 서버)

```powershell
$tmp = New-TemporaryFile
$sql = @"
CREATE DATABASE IF NOT EXISTS groupware
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'groupware_app'@'localhost'
    IDENTIFIED BY '$DB_PW';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
    ON groupware.* TO 'groupware_app'@'localhost';

FLUSH PRIVILEGES;
SELECT User, Host FROM mysql.user WHERE User='groupware_app';
"@

$sql | & "C:\Program Files\MariaDB 12.1\bin\mysql.exe" `
    --defaults-file=$tmp -u root -p$ROOT_PW --host=127.0.0.1 --port=3300
```

출력에 `groupware_app | localhost` 가 보이면 정상입니다.

---

## 4단계. DB 복원 (새 서버)

기존 서버에서 복사해 온 백업 파일 경로를 확인 후 실행합니다.

```powershell
# 백업 파일 경로 (USB 또는 공유 폴더에서 복사한 위치)
$BACKUP_SQL = "C:\migration\groupware_migration.sql"

# DB 복원
$tmp = New-TemporaryFile
& "C:\Program Files\MariaDB 12.1\bin\mysql.exe" `
    --defaults-file=$tmp -u root -p$ROOT_PW `
    --host=127.0.0.1 --port=3300 groupware < $BACKUP_SQL

# 복원 확인 (직원 수, 결재문서 수 확인)
$tmp = New-TemporaryFile
& "C:\Program Files\MariaDB 12.1\bin\mysql.exe" `
    --defaults-file=$tmp -u root -p$ROOT_PW `
    --host=127.0.0.1 --port=3300 groupware -e `
    "SELECT COUNT(*) AS '직원수' FROM users;
     SELECT COUNT(*) AS '결재문서' FROM approval_documents;
     SELECT COUNT(*) AS '게시글' FROM posts;"
```

기존 서버의 데이터와 건수가 일치하는지 확인합니다.

---

## 5단계. 코드 배포 (새 서버)

```powershell
# 코드 받기
cd C:\
git clone https://github.com/2015211384dg-ux/groupware.git
cd C:\groupware

# 백엔드 패키지 설치
cd C:\groupware\backend
npm install --omit=dev

# 프론트엔드 패키지 설치 및 빌드
cd C:\groupware\frontend
npm install
npm run build

# 빌드 성공 확인
if (Test-Path "C:\groupware\frontend\dist\index.html") {
    Write-Host "✅ 프론트엔드 빌드 성공"
} else {
    Write-Host "❌ 빌드 실패 — npm run build 오류 확인 필요"
}
```

---

## 6단계. 필수 디렉토리 생성 (새 서버)

```powershell
mkdir C:\groupware\backend\uploads          -Force
mkdir C:\groupware\backend\uploads\approval -Force
mkdir C:\groupware\logs                     -Force
mkdir C:\groupware\backup                   -Force
Write-Host "✅ 디렉토리 생성 완료"
```

---

## 7단계. 업로드 파일 복원 (새 서버)

```powershell
$BACKUP_ZIP = "C:\migration\uploads_migration.zip"

Expand-Archive -Path $BACKUP_ZIP `
    -DestinationPath C:\groupware\backend\ -Force

Write-Host "✅ 업로드 파일 복원 완료"
ls C:\groupware\backend\uploads | Measure-Object | Select-Object Count
```

---

## 8단계. 환경 설정 파일 생성 (새 서버)

### 8-1. .env 생성

```powershell
# 기존 서버의 SMTP 정보 확인 후 아래 값 입력
$SMTP_USER = "[SMTP_이메일_주소]"        # 예: Xeroxscan@amphenol-sensors.com
$SMTP_PASS = "[SMTP_비밀번호]"           # 기존 서버 .env에서 복사
$SMTP_NAME = "[발신자이름]"              # 예: Xeroxscan

$envContent = @"
# 서버 설정
PORT=5001
NODE_ENV=production

# 데이터베이스
DB_HOST=localhost
DB_PORT=3300
DB_USER=groupware_app
DB_PASSWORD=$DB_PW
DB_NAME=groupware

# JWT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=7

# 파일 업로드
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800

# CORS
CORS_ORIGIN=http://${NEW_IP}:3000

# 세션
SESSION_SECRET=$SESSION_SECRET

# AI 챗봇
RAG_SERVICE_URL=http://localhost:8001

# 이메일
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM_NAME=$SMTP_NAME
APP_URL=http://${NEW_IP}:3000
"@

$envContent | Out-File -FilePath "C:\groupware\backend\.env" -Encoding UTF8 -NoNewline
Write-Host "✅ .env 생성 완료"

# 내용 확인 (비밀번호 포함 — 확인 후 화면 닫기)
Get-Content C:\groupware\backend\.env
```

### 8-2. .env 파일 권한 제한

```powershell
icacls "C:\groupware\backend\.env" /inheritance:r
icacls "C:\groupware\backend\.env" /grant:r "$env:USERNAME:(R,W)"
Write-Host "✅ .env 권한 설정 완료"
```

### 8-3. 백업용 DB 접속 설정 파일 생성

```powershell
$backupCnf = @"
[client]
user=groupware_app
password=$DB_PW
"@

$backupCnf | Out-File -FilePath "C:\groupware\backup\my-backup.cnf" -Encoding UTF8 -NoNewline

icacls "C:\groupware\backup\my-backup.cnf" /inheritance:r
icacls "C:\groupware\backup\my-backup.cnf" /grant:r "$env:USERNAME:(R,W)"
Write-Host "✅ my-backup.cnf 생성 완료"
```

---

## 9단계. ecosystem.config.js 확인 (새 서버)

```powershell
# 현재 설정 확인
Get-Content C:\groupware\ecosystem.config.js
```

`groupware-backend` 의 `PORT: 5001`, `NODE_ENV: 'production'` 이 있으면 정상입니다.  
`--port 3000` 으로 Vite 프론트엔드가 설정되어 있으면 정상입니다.

로그 경로 내 IP 주소(`10.18.10.70`)가 있다면 새 서버 IP로 변경합니다:

```powershell
# server.js 내 로그용 IP 교체 (기능에는 무관하지만 로그 정확성을 위해)
(Get-Content C:\groupware\backend\server.js) `
    -replace '10\.18\.10\.70', $NEW_IP `
    | Set-Content C:\groupware\backend\server.js
Write-Host "✅ server.js IP 업데이트 완료"
```

---

## 10단계. PM2 실행 및 자동 시작 등록 (새 서버)

```powershell
cd C:\groupware

# 기존 PM2 프로세스 정리 (혹시 있을 경우)
pm2 delete all 2>$null

# ecosystem.config.js 기반으로 실행
pm2 start ecosystem.config.js

# 3초 대기 후 상태 확인
Start-Sleep -Seconds 3
pm2 list
```

`groupware-backend` 와 `groupware-frontend` 모두 **online** 이어야 합니다.

```powershell
# DB 연결 확인
pm2 logs groupware-backend --lines 15 --nostream
# "✅ 데이터베이스 연결 성공" 이 반드시 보여야 함
```

```powershell
# 현재 상태 저장
pm2 save

# Windows 재부팅 후 자동 시작 등록 (관리자 권한 필요)
pm2-startup install
pm2 save
Write-Host "✅ PM2 자동 시작 등록 완료"
```

---

## 11단계. 방화벽 설정 (새 서버)

```powershell
# 3000 포트 인바운드 허용 (사용자 접속용)
netsh advfirewall firewall add rule `
    name="Groupware-3000-IN" dir=in action=allow protocol=TCP localport=3000

# 설정 확인
netsh advfirewall firewall show rule name="Groupware-3000-IN"
Write-Host "✅ 방화벽 설정 완료"
```

> 5001 포트(백엔드 API)는 서버 내부에서만 사용하므로 방화벽 오픈 불필요합니다.

---

## 12단계. 자동 백업 설정 (새 서버)

### 백업 스크립트 생성

```powershell
$backupScript = @'
@echo off
set BACKUP_DIR=D:\Backup\groupware
set YEAR=%date:~0,4%
set MONTH=%date:~5,2%
set DAY=%date:~8,2%
set DATE_STR=%YEAR%%MONTH%%DAY%

if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%

REM DB 백업
"C:\Program Files\MariaDB 12.1\bin\mysqldump.exe" ^
  --defaults-file=C:\groupware\backup\my-backup.cnf ^
  --single-transaction --host=127.0.0.1 --port=3300 ^
  groupware > %BACKUP_DIR%\groupware_db_%DATE_STR%.sql

REM 업로드 파일 백업
powershell -Command "Compress-Archive -Path C:\groupware\backend\uploads -DestinationPath '%BACKUP_DIR%\groupware_uploads_%DATE_STR%.zip' -Force"

REM 7일 이상 된 파일 삭제
forfiles /p %BACKUP_DIR% /m groupware_db_*.sql /d -7 /c "cmd /c del @path" 2>nul
forfiles /p %BACKUP_DIR% /m groupware_uploads_*.zip /d -7 /c "cmd /c del @path" 2>nul

echo %date% %time% 백업 완료 >> C:\groupware\logs\backup.log
'@

$backupScript | Out-File -FilePath "C:\groupware\backup\backup.bat" -Encoding OEM
Write-Host "✅ 백업 스크립트 생성: C:\groupware\backup\backup.bat"
```

### 백업 저장 위치 생성

```powershell
# 백업용 드라이브가 D:\ 인 경우 (없으면 C:\Backup으로 변경)
mkdir D:\Backup\groupware -Force
# 또는
# mkdir C:\Backup\groupware -Force
# (C:\Backup 사용 시 backup.bat 내 BACKUP_DIR 경로도 함께 수정)
```

### Windows 작업 스케줄러 등록 (매일 새벽 2시)

```powershell
$action  = New-ScheduledTaskAction -Execute "C:\groupware\backup\backup.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$settings = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable:$false

Register-ScheduledTask `
    -TaskName "GroupwareBackup" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force

Write-Host "✅ 자동 백업 스케줄 등록 완료 (매일 02:00)"
```

### 백업 1회 수동 테스트

```powershell
& C:\groupware\backup\backup.bat

Start-Sleep -Seconds 5
ls D:\Backup\groupware   # 백업 파일 생성 확인
Get-Content C:\groupware\logs\backup.log   # 성공 로그 확인
```

---

## 13단계. 최종 검증

모든 설정이 완료됐는지 순서대로 확인합니다.

```powershell
Write-Host "`n=== 최종 검증 시작 ===" -ForegroundColor Cyan

# 1. PM2 상태
Write-Host "`n[1] PM2 프로세스 상태" -ForegroundColor Yellow
pm2 list

# 2. 백엔드 헬스체크
Write-Host "`n[2] 백엔드 헬스체크 (port 5001)" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5001/health" -UseBasicParsing
    Write-Host "✅ 백엔드 응답 OK:" $r.Content
} catch {
    Write-Host "❌ 백엔드 응답 없음 — pm2 logs groupware-backend 확인 필요"
}

# 3. 프론트엔드 접속 확인
Write-Host "`n[3] 프론트엔드 접속 확인 (port 3000)" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
    Write-Host "✅ 프론트엔드 응답 OK (StatusCode:" $r.StatusCode ")"
} catch {
    Write-Host "❌ 프론트엔드 응답 없음 — pm2 logs groupware-frontend 확인 필요"
}

# 4. DB 연결 확인
Write-Host "`n[4] DB 데이터 확인" -ForegroundColor Yellow
$tmp = New-TemporaryFile
& "C:\Program Files\MariaDB 12.1\bin\mysql.exe" `
    --defaults-file=$tmp -u root -p$ROOT_PW `
    --host=127.0.0.1 --port=3300 groupware `
    -e "SELECT COUNT(*) AS '직원수' FROM users; SELECT COUNT(*) AS '결재문서' FROM approval_documents;"

# 5. 업로드 폴더 확인
Write-Host "`n[5] 업로드 폴더 확인" -ForegroundColor Yellow
if (Test-Path "C:\groupware\backend\uploads\approval") {
    Write-Host "✅ uploads 폴더 정상"
} else {
    Write-Host "❌ uploads\approval 폴더 없음"
}

# 6. .env 핵심 항목 확인 (값은 숨김)
Write-Host "`n[6] .env 설정 확인" -ForegroundColor Yellow
Get-Content C:\groupware\backend\.env | Where-Object {
    $_ -match "^(PORT|NODE_ENV|DB_HOST|DB_PORT|CORS_ORIGIN|APP_URL)="
}

# 7. 백업 스크립트 확인
Write-Host "`n[7] 백업 설정 확인" -ForegroundColor Yellow
if (Test-Path "C:\groupware\backup\backup.bat") { Write-Host "✅ backup.bat 존재" }
if (Test-Path "C:\groupware\backup\my-backup.cnf") { Write-Host "✅ my-backup.cnf 존재" }
Get-ScheduledTask -TaskName "GroupwareBackup" -ErrorAction SilentlyContinue |
    Select-Object TaskName, State

Write-Host "`n=== 검증 완료 ===" -ForegroundColor Cyan
Write-Host "브라우저에서 http://$NEW_IP`:3000 접속하여 로그인 테스트를 진행하세요." -ForegroundColor Green
```

---

## 최종 체크리스트

### 기능 테스트 (브라우저에서 직접 확인)

- [ ] `http://[새_서버_IP]:3000` 접속 → 로그인 화면 표시
- [ ] 로그인 성공
- [ ] 게시판 목록 정상 표시
- [ ] 캘린더 정상 표시
- [ ] 전자결재 문서 목록 정상 표시
- [ ] 결재문서 1개 열람 (첨부파일 표시 확인)
- [ ] 파일 업로드 테스트 (게시판에 파일 첨부)
- [ ] AR 예산 페이지 정상 표시
- [ ] 알림 벨 정상 동작

### 보안 확인

- [ ] `.env` 파일 권한 확인 (`icacls C:\groupware\backend\.env`)
- [ ] `my-backup.cnf` 권한 확인 (`icacls C:\groupware\backup\my-backup.cnf`)
- [ ] 5001 포트 외부 접속 차단 확인 (다른 PC에서 `http://[새_IP]:5001` 접속 안 됨)
- [ ] 기존 서버에서 새 서버로 정상 접속 전환 안내

### 기존 서버 정리 (마이그레이션 완료 후)

- [ ] 사내 전체 공지: 접속 주소 변경 안내 (`http://[새_서버_IP]:3000`)
- [ ] 데스크탑 앱 사용자: 앱 재설치 또는 서버 IP 재설정 안내
- [ ] 기존 서버(10.18.10.70) 데이터 보관 기간 결정 후 정리

---

## 문제 발생 시

| 증상 | 확인 명령 | 해결 |
|------|-----------|------|
| DB 연결 실패 | `pm2 logs groupware-backend --lines 20` | `.env` 의 `DB_PASSWORD` 값과 3단계에서 설정한 비밀번호 일치 여부 확인 |
| 로그인 안 됨 | 브라우저 F12 → Network 탭 | 기존 서버 `.env` 의 `JWT_SECRET` 값을 새 서버 `.env` 에 동일하게 입력 (기존 세션 유지 시) |
| 프론트 흰 화면 | `pm2 logs groupware-frontend` | `cd frontend && npm run build` 재실행 |
| 파일 열람 안 됨 | uploads 폴더 확인 | 7단계 업로드 파일 복원 재실행 |
| 5001 포트 오류 | `pm2 list` | `pm2 restart groupware-backend --update-env` |
| 쿠키 로그인 유지 안 됨 | 브라우저 쿠키 확인 | `NODE_ENV=production` 확인, sameSite lax / secure false 확인 |
