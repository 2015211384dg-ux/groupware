# 그룹웨어 - 사내 업무 협업 시스템

사내 전용 그룹웨어 시스템입니다. 게시판, 전자결재, 주소록, 캘린더, 인사관리 등 업무에 필요한 기능을 통합 제공합니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 18, Vite, React Router v6 |
| Backend | Node.js, Express |
| Database | MySQL (port 3300) |
| 프로세스 관리 | PM2 |
| 인증 | JWT (httpOnly Cookie) |
| 에디터 | React Quill |

---

## 주요 기능

- 로그인 / 인증 (JWT, 비밀번호 강제 변경)
- 대시보드
- 게시판 (게시글 CRUD, 댓글, 좋아요, 파일 첨부, 공지/고정 게시글)
- 전자결재 (기안, 승인/반려, 관리자 뷰)
- 주소록 (조직도, 전체 주소록, 개인 주소록)
- 캘린더
- 인사관리 (내 정보)
- 검색
- 관리자 기능 (사용자 관리, 부서 관리, 시스템 설정)
- 데스크탑 앱 (Electron)

---

## 프로젝트 구조

```
groupware/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── cache.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── departments.js
│   │   ├── boards.js
│   │   ├── posts.js
│   │   ├── comments.js
│   │   ├── attachments.js
│   │   ├── addressbook.js
│   │   ├── approval.js
│   │   ├── events.js
│   │   ├── hr.js
│   │   ├── search.js
│   │   ├── settings.js
│   │   ├── feedback.js
│   │   ├── notifications.js
│   │   └── dashboard.js
│   ├── uploads/
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout/
│   │   │       ├── Layout.js
│   │   │       ├── Header.js
│   │   │       └── Sidebar.js
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   ├── PostList.js
│   │   │   ├── PostDetail.js
│   │   │   ├── PostWrite.js
│   │   │   ├── BoardList.js
│   │   │   ├── Approval.js
│   │   │   ├── ApprovalDetail.js
│   │   │   ├── ApprovalWrite.js
│   │   │   ├── Calendar.js
│   │   │   ├── AddressBook.js
│   │   │   ├── Organization.js
│   │   │   ├── MyInfo.js
│   │   │   ├── UserManagement.js
│   │   │   ├── DepartmentManagement.js
│   │   │   └── Settings.js
│   │   ├── services/
│   │   │   └── authService.js
│   │   └── App.js
│   └── package.json
│
├── desktop/               # Electron 데스크탑 앱
├── groupware_schema.sql   # DB 스키마
├── DEPLOYMENT.md          # 서버 배포 가이드
└── README.md
```

---

## 설치 및 실행

### 1. 데이터베이스 설정

```bash
# MySQL 접속 (포트 3300)
mysql -u root -p -P 3300

# DB 생성 및 스키마 적용
CREATE DATABASE groupware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

mysql -u root -p -P 3300 groupware < groupware_schema.sql
```

### 2. 백엔드 설정

```bash
cd backend
npm install

# .env 파일 생성
cp .env.example .env
```

`.env` 필수 항목:

```env
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3300
DB_USER=root
DB_PASSWORD=비밀번호
DB_NAME=groupware

JWT_SECRET=랜덤_64자_이상_문자열
JWT_EXPIRES_IN=24h

UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800

CORS_ORIGIN=http://서버IP:3000
```

### 3. 프론트엔드 빌드

```bash
cd frontend
npm install
npm run build
```

빌드 결과물(`frontend/dist/`)은 백엔드가 자동으로 서빙합니다.

### 4. 서버 실행

```bash
cd backend
pm2 start server.js --name groupware-backend
pm2 save
```

---

## 접속

| 항목 | 주소 |
|------|------|
| 웹 접속 | http://서버IP:3000 |
| 기본 관리자 계정 | admin / admin123 |

---

## 코드 수정 후 배포

```bash
# 프론트엔드 변경 시
cd frontend && npm run build

# 백엔드 재시작
pm2 restart groupware-backend
```

---

## 관리자 권한

| 역할 | 권한 |
|------|------|
| SUPER_ADMIN | 전체 관리 |
| ADMIN | 사용자/게시판 관리 |
| HR_ADMIN | 인사 관리 |
| USER | 일반 사용자 |

---

## 서버 배포 가이드

온프레미스 Windows Server 배포 방법은 [DEPLOYMENT.md](./DEPLOYMENT.md) 를 참고하세요.
