# 그룹웨어 - 사내 업무 통합 협업 시스템

> 암페놀센싱코리아 전용 사내 그룹웨어 플랫폼입니다.  
> 전자결재·예산관리·프로젝트·AI 챗봇·데스크탑 알림까지 업무에 필요한 모든 기능을 하나의 시스템에서 제공합니다.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=flat&logo=mariadb&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat&logo=electron&logoColor=white)
![PM2](https://img.shields.io/badge/PM2-2B037A?style=flat&logo=pm2&logoColor=white)
![Python](https://img.shields.io/badge/Python_RAG-3776AB?style=flat&logo=python&logoColor=white)

---

## 목차

1. [기능 개요](#기능-개요)
2. [기술 스택](#기술-스택)
3. [시스템 아키텍처](#시스템-아키텍처)
4. [프로젝트 구조](#프로젝트-구조)
5. [설치 및 실행](#설치-및-실행)
6. [PM2 프로세스 구성](#pm2-프로세스-구성)
7. [환경 변수](#환경-변수)
8. [권한 구조](#권한-구조)
9. [알림 구조](#알림-구조)
10. [보안 정책 (ISO 27001)](#보안-정책)
11. [배포 가이드](#배포-가이드)

---

## 기능 개요

### 대시보드
- 미결재 문서·공지사항·오늘의 일정·최근 AR 현황 한눈에 확인
- 역할별 위젯 표시 분리

### 게시판
- 게시글 CRUD·파일 첨부(최대 50 MB)·이미지 인라인 미리보기
- 댓글·대댓글·좋아요·조회수
- 공지 고정·게시판별 권한 설정
- 관리자 게시판 관리 (생성·수정·삭제·접근 권한 설정)

### 전자결재
- 결재 양식 선택 → Rich Text 기안 작성 (React Quill)
- 결재선 설정 (다단계 승인·병렬 결재 지원)
- 승인·반려·참조·회수
- 결재 현황 대시보드·이력 추적
- 관리자 전체 결재 열람·강제 처리

### AR 예산관리
- AR 프로젝트 생성·수정·삭제·총 예산 설정
- 지출 항목 등록 (카테고리·날짜·금액·설명·증빙 첨부)
- 잔여 예산 실시간 추적 및 초과 경고
- 월별·카테고리별 차트 시각화
- Excel 내보내기
- 부서별 AR 접근 제어 (재경팀·관리자 전체 열람 / 일반 직원 소속 부서만)

### 캘린더
- 개인·공용 일정 등록·수정·삭제
- 월별 뷰·일정 색상 구분

### 주소록
- 조직도 (트리 레이아웃, 25 부서 70~80명 기준 compact 카드)
- 전체 사용자 주소록·개인 연락처 관리

### 프로젝트 관리 (ProjectHub)
- 프로젝트 생성·참여자 초대 (owner / manager / member / viewer 역할)
- 업무 탭: 칸반 태스크 관리 (할 일 → 진행 중 → 완료 → 보류)·마감일 D-Day 표시
- 피드 탭: 프로젝트 내 의견·업데이트 공유
- 프로젝트 아이콘 커스터마이징

### AI 챗봇 (사내 규정 RAG)
- 회사 내부 규정 문서를 ChromaDB에 벡터화하여 RAG 검색
- Ollama 로컬 LLM 기반 응답 (외부 API 미사용·데이터 외부 유출 없음)
- 대화 세션 관리·답변 피드백 (좋아요/싫어요)
- RAG 서비스 온라인/오프라인 상태 실시간 표시

### AI 전표 자동화 (VoucherAI)
- 영수증·세금계산서 이미지(JPG·PNG·PDF) 드래그앤드롭 업로드
- AI 텍스트 추출 → 전표 항목 자동 파싱 (pdfjs-dist)
- 결과 테이블 편집 후 Excel 다운로드

### 시스템 모니터 (관리자 전용)
- PM2 프로세스(Backend / Frontend / RAG) 실시간 상태 조회
- 애플리케이션 로그 실시간 스트리밍·검색 (에러/경고/정보/성공 레벨 필터)
- 로그 페이지네이션·다운로드

### 접근권한 검토 (AccessReview)
- ISO 27001 A.9 준수를 위한 정기 접근권한 검토 워크플로
- 역할 미검토·확인·변경·비활성화 액션 기록
- 검토 이력 감사 로그

### 알림
- 인앱 벨 알림 (Header 30초 폴링)
- 데스크탑 앱 (Electron) 15초 폴링 → 시스템 트레이 토스트 팝업
- 결재 요청·승인·반려·AR 팀 배정·게시글·댓글 이벤트

### 데스크탑 앱 (Electron)
- Windows 시스템 트레이 상주
- 실시간 알림 토스트 팝업
- 알림함 (읽음·미읽음 관리)
- Magic Link 자동 로그인

### 인사/조직 관리
- 내 정보 조회·수정·프로필 이미지 업로드
- 인사발령 이력 조회
- 부서 관리 / 사용자 생성·수정·비활성화

### 고객사 관리
- 고객사 등록·조회·수정
- 결재선 연동 (CustomerRegistrationLineAdmin)

### 시스템 설정 (관리자)
- 사이트명·파비콘·로고 변경
- 팝업 공지 등록·관리
- 점검 모드 (MaintenancePage)
- 다크 모드 지원
- 피드백 수집·관리

---

## 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| Frontend | React | 18 |
| Frontend | Vite | - |
| Frontend | React Router | v6 |
| Frontend | React Quill | 2.0 |
| Frontend | XLSX | - |
| Backend | Node.js + Express | 4.18 |
| Backend | JWT (Access + Refresh Token) | jsonwebtoken 9 |
| Backend | bcryptjs | 3 |
| Backend | Helmet + express-rate-limit | 보안 미들웨어 |
| Backend | Multer + Sharp | 파일 업로드·이미지 처리 |
| Backend | Nodemailer | 이메일 발송 |
| Backend | pdfjs-dist | PDF 텍스트 추출 |
| Database | MariaDB | port 3300 |
| AI / RAG | Python + FastAPI + ChromaDB | rag_service/ |
| AI / LLM | Ollama (로컬 LLM) | 외부 API 미사용 |
| 프로세스 관리 | PM2 | ecosystem.config.js |
| 데스크탑 앱 | Electron | desktop/ |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                       클라이언트                          │
│                                                          │
│   브라우저 (React SPA)          Electron 데스크탑 앱      │
│   - Vite dev server :3000       - 시스템 트레이 상주      │
│   - React Router v6             - 15초 폴링 토스트 알림   │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / REST API
┌───────────────────────▼─────────────────────────────────┐
│              Backend API Server (Express :5001)          │
│                                                          │
│   auth · users · departments · boards · posts            │
│   approval · ar · events · hr · search                   │
│   notifications · settings · feedback · projects         │
│   chatbot · voucher · systemMonitor · accessReview       │
│                                                          │
│   미들웨어: JWT 인증 / Rate Limit / Helmet / CORS / Cache │
└──────────┬────────────────────────┬────────────────────┘
           │                        │
┌──────────▼──────────┐   ┌─────────▼──────────────────┐
│  MariaDB :3300       │   │  RAG Service (Python :8001)  │
│  - groupware DB      │   │  - FastAPI + ChromaDB        │
│  - utf8mb4           │   │  - Ollama 로컬 LLM            │
└─────────────────────┘   │  - 사내 규정 문서 벡터 검색   │
                          └────────────────────────────┘
```

**PM2 프로세스 3개**로 운영:

| 프로세스명 | 역할 | 포트 |
|-----------|------|------|
| `groupware-backend` | Express API 서버 | 5001 |
| `groupware-frontend` | Vite 프론트엔드 서버 | 3000 |
| `rag-service` | Python RAG / AI 챗봇 | 8001 |

---

## 프로젝트 구조

```
groupware/
├── backend/
│   ├── config/
│   │   └── database.js          # MariaDB 연결 풀
│   ├── middleware/
│   │   ├── auth.js              # JWT 검증·역할 체크
│   │   └── cache.js             # 응답 캐시
│   ├── routes/
│   │   ├── auth.js              # 로그인·토큰 재발급·Magic Link
│   │   ├── users.js             # 사용자 CRUD
│   │   ├── departments.js       # 부서 관리
│   │   ├── boards.js / posts.js / comments.js / attachments.js
│   │   ├── approval.js / approvalAdmin.js
│   │   ├── ar.js                # AR 예산관리
│   │   ├── events.js            # 캘린더
│   │   ├── addressbook.js       # 주소록·조직도
│   │   ├── hr.js                # 인사관리
│   │   ├── projects.js / workflow.js  # 프로젝트 관리
│   │   ├── chatbot.js           # AI 챗봇 (RAG 프록시)
│   │   ├── voucher.js           # AI 전표 자동화
│   │   ├── notifications.js     # 통합 알림
│   │   ├── systemMonitor.js     # 시스템 모니터
│   │   ├── accessReview.js      # 접근권한 검토
│   │   ├── search.js            # 통합 검색
│   │   ├── settings.js          # 시스템 설정
│   │   ├── feedback.js          # 피드백
│   │   ├── clientLogs.js        # 클라이언트 에러 수집
│   │   └── dashboard.js
│   ├── utils/
│   ├── uploads/                 # 첨부파일 저장
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/          # Icons·Toast·UserAvatar 등 공통 컴포넌트
│   │   │   ├── Layout/          # Header·Sidebar·Layout
│   │   │   └── project/         # 프로젝트 관련 컴포넌트
│   │   ├── pages/               # 페이지 컴포넌트 (각 .js + .css)
│   │   ├── services/
│   │   │   ├── api.js           # Axios 인스턴스
│   │   │   └── authService.js
│   │   ├── context/
│   │   │   └── SettingsContext.js
│   │   ├── hooks/
│   │   ├── routes/
│   │   │   └── AppRoutes.js
│   │   ├── styles/
│   │   │   └── dark-theme.css   # 다크 모드 테마
│   │   └── App.js
│   └── package.json
│
├── desktop/                     # Electron 데스크탑 알림 앱
│   ├── main.js
│   ├── preload.js
│   ├── preload-notification.js
│   ├── preload-inbox.js
│   └── renderer/
│
├── rag_service/                 # Python AI 챗봇 서비스
│   ├── main.py                  # FastAPI 서버
│   ├── ingest.py                # 문서 → ChromaDB 벡터화
│   ├── validate.py              # RAG 답변 품질 검증
│   ├── requirements.txt
│   └── docs/                   # 벡터화 대상 내부 규정 문서
│
├── docs/                        # ISO 27001 보안 문서
│   ├── SECURITY-POLICY.md
│   ├── RISK-ASSESSMENT.md
│   ├── SOA.md
│   ├── INCIDENT-RESPONSE.md
│   ├── CHANGE-MANAGEMENT.md
│   ├── BACKUP-RECOVERY.md
│   └── PRIVACY-POLICY.md
│
├── ecosystem.config.js          # PM2 프로세스 설정
├── groupware_schema.sql         # DB 스키마
├── DEPLOYMENT.md                # 온프레미스 배포 가이드
├── DEPLOYMENT-NGINX.md          # Nginx 리버스 프록시 설정
└── DEV-WORKFLOW.md              # 개발 워크플로
```

---

## 설치 및 실행

### 요구 사항

- Node.js 18+
- MariaDB 10.6+ (port 3300)
- Python 3.10+ (RAG 서비스)
- PM2 (`npm install -g pm2`)
- Ollama (AI 챗봇 사용 시)

### 1. 데이터베이스 설정

```bash
# MariaDB 접속
mysql -u root -p -P 3300

# DB 생성
CREATE DATABASE groupware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 스키마 적용
mysql -u root -p -P 3300 groupware < groupware_schema.sql
```

### 2. 백엔드 설정

```bash
cd backend
npm install
cp .env.example .env
# .env 내용 편집 (아래 환경 변수 섹션 참고)
```

### 3. 프론트엔드 설정

```bash
cd frontend
npm install
npm run dev   # 개발 환경: Vite dev server :3000
```

### 4. RAG 서비스 설정 (AI 챗봇 사용 시)

```bash
cd rag_service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 내부 규정 문서를 docs/ 폴더에 넣은 후 벡터화
python ingest.py
```

Ollama 모델 다운로드:
```bash
ollama pull llama3
```

### 5. PM2로 전체 서비스 실행

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## PM2 프로세스 구성

`ecosystem.config.js` 에 3개 프로세스가 정의됩니다.

| 프로세스 | 스크립트 | 포트 | 로그 경로 |
|---------|---------|------|----------|
| `groupware-backend` | `backend/server.js` | 5001 | `logs/backend-*.log` |
| `groupware-frontend` | Vite (`--port 3000`) | 3000 | `logs/frontend-*.log` |
| `rag-service` | `rag_service/main.py` | 8001 | `logs/rag-*.log` |

```bash
pm2 status
pm2 restart groupware-backend
pm2 logs groupware-backend
```

> 시스템 모니터 페이지(관리자 전용)에서 브라우저로 PM2 상태와 로그를 실시간 확인할 수 있습니다.

---

## 환경 변수

`backend/.env` 필수 항목:

```env
PORT=5001
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3300
DB_USER=root
DB_PASSWORD=비밀번호
DB_NAME=groupware

JWT_SECRET=랜덤_64자_이상_문자열
JWT_EXPIRES_IN=24h
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=7

UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800

CORS_ORIGIN=http://서버IP:3000
RAG_SERVICE_URL=http://localhost:8001
```

---

## 권한 구조

### 사용자 역할

| 역할 | 코드 | 권한 |
|------|------|------|
| 최고관리자 | `SUPER_ADMIN` | 전체 시스템 관리·모든 데이터 접근 |
| 관리자 | `ADMIN` | 사용자·게시판·AR·피드백 관리 |
| 인사관리자 | `HR_ADMIN` | 인사발령·조직 관리 |
| 일반 사용자 | `USER` | 본인 권한 내 기능 사용 |

### AR 예산관리 접근 제어

| 구분 | 열람 범위 |
|------|----------|
| `ADMIN` / `SUPER_ADMIN` | 전체 AR 프로젝트 |
| 재경팀 (dept_id = 4) | 전체 AR 프로젝트 |
| 일반 직원 | 소속 부서가 배정된 AR 프로젝트만 |

---

## 알림 구조

```
결재 요청·승인·반려·AR 팀 배정·게시글·댓글 이벤트
               ↓
  approval_notifications 테이블 (결재 / AR 통합)
  notifications 테이블 (게시글·댓글·피드백)
               ↓
  ┌────────────────────┬────────────────────────┐
  │  인앱 벨 (Header)   │  Electron 데스크탑 앱   │
  │  30초 폴링          │  15초 폴링              │
  │  벨 아이콘 배지      │  시스템 트레이 토스트    │
  └────────────────────┴────────────────────────┘
```

---

## 보안 정책

ISO 27001 대응 문서가 `docs/` 폴더에 정비되어 있습니다.

| 문서 | 내용 |
|------|------|
| [SECURITY-POLICY.md](./docs/SECURITY-POLICY.md) | 정보보안 정책서 (ISP-001) |
| [RISK-ASSESSMENT.md](./docs/RISK-ASSESSMENT.md) | 위험 평가 |
| [SOA.md](./docs/SOA.md) | 적용 가능성 선언서 |
| [INCIDENT-RESPONSE.md](./docs/INCIDENT-RESPONSE.md) | 보안 사고 대응 절차 |
| [CHANGE-MANAGEMENT.md](./docs/CHANGE-MANAGEMENT.md) | 변경 관리 절차 |
| [BACKUP-RECOVERY.md](./docs/BACKUP-RECOVERY.md) | 백업·복구 계획 |
| [PRIVACY-POLICY.md](./docs/PRIVACY-POLICY.md) | 개인정보 처리방침 |

### 구현된 보안 기능

- **인증**: JWT Access Token (15분) + Refresh Token (7일) 이중 토큰 방식
- **비밀번호**: bcryptjs 해싱·최초 로그인 강제 변경
- **요청 제한**: express-rate-limit (로그인 브루트포스 방지)
- **헤더 보안**: Helmet (XSS·CSRF·Clickjacking 방어)
- **입력 검증**: express-validator
- **접근권한 검토**: 정기 Access Review 워크플로 (AccessReview 페이지)
- **감사 로그**: 주요 작업 이력 DB 기록
- **파일 보안**: Multer + Sharp·확장자·MIME 타입 검증

---

## 배포 가이드

| 가이드 문서 | 내용 |
|------------|------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 온프레미스 Windows Server 배포 전체 절차 |
| [DEPLOYMENT-NGINX.md](./DEPLOYMENT-NGINX.md) | Nginx 리버스 프록시 설정 |
| [DEV-TO-PROD.md](./DEV-TO-PROD.md) | 개발 환경 → 운영 전환 체크리스트 |
| [DEV-WORKFLOW.md](./DEV-WORKFLOW.md) | 개발 브랜치 워크플로 |
| [AI-CHATBOT-SETUP.md](./AI-CHATBOT-SETUP.md) | RAG 챗봇 초기 설치 및 문서 등록 가이드 |

### 코드 수정 후 빠른 배포

```bash
# 프론트엔드: Vite HMR로 자동 반영 (dev) 또는 pm2 재시작
pm2 restart groupware-frontend

# 백엔드
pm2 restart groupware-backend

# RAG 문서 추가 후 재벡터화
cd rag_service && python ingest.py
pm2 restart rag-service
```

---

## 기본 접속 정보

| 항목 | 값 |
|------|-----|
| 웹 접속 | `http://서버IP:3000` |
| 기본 관리자 계정 | `admin` / `admin123` |
| API 서버 | `http://서버IP:5001` |

> 최초 배포 후 반드시 관리자 비밀번호를 변경하세요.
