# 그룹웨어 Phase 1 - 설치 및 실행 가이드

## 📁 프로젝트 구조

```
groupware/
├── backend/
│   ├── config/
│   │   └── database.js          # DB 연결 설정
│   ├── middleware/
│   │   └── auth.js               # 인증 미들웨어
│   ├── routes/
│   │   ├── auth.js               # 인증 라우트 (로그인, 로그아웃)
│   │   ├── users.js              # 사용자 관리 라우트
│   │   ├── departments.js        # 부서 관리 라우트
│   │   ├── boards.js             # 게시판 라우트 (빈 파일)
│   │   ├── addressbook.js        # 주소록 라우트 (빈 파일)
│   │   └── hr.js                 # HR 라우트 (빈 파일)
│   ├── uploads/                  # 파일 업로드 폴더
│   │   └── .gitkeep
│   ├── .env.example              # 환경 변수 예시
│   ├── .gitignore
│   ├── server.js                 # 메인 서버 파일
│   └── package.json              # 패키지 정보
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout/
│   │   │       ├── Layout.js     # 메인 레이아웃
│   │   │       ├── Layout.css
│   │   │       ├── Header.js     # 헤더 컴포넌트
│   │   │       ├── Header.css
│   │   │       ├── Sidebar.js    # 사이드바 컴포넌트
│   │   │       └── Sidebar.css
│   │   ├── pages/
│   │   │   ├── Login.js          # 로그인 페이지
│   │   │   ├── Login.css
│   │   │   ├── Dashboard.js      # 대시보드
│   │   │   ├── Dashboard.css
│   │   │   ├── NotFound.js       # 404 페이지
│   │   │   └── NotFound.css
│   │   ├── services/
│   │   │   └── authService.js    # API 통신 서비스
│   │   ├── App.js                # 메인 앱
│   │   ├── App.css               # 전역 스타일
│   │   ├── index.js              # React 진입점
│   │   └── index.css             # 기본 스타일
│   ├── .env.example              # 환경 변수 예시
│   ├── .gitignore
│   └── package.json              # 패키지 정보
│
├── groupware_schema.sql          # 데이터베이스 스키마
└── README.md                     # 이 파일
```

## 🚀 설치 방법

### 1. 데이터베이스 설정

```bash
# MariaDB 접속 (포트 3300)
mysql -u root -p -P 3300

# 스키마 파일 실행
source groupware_schema.sql;
```

**중요**: 기본 관리자 계정의 비밀번호를 bcrypt로 해싱해야 합니다.

```javascript
// bcrypt로 비밀번호 해싱하기
const bcrypt = require('bcrypt');
const password = 'admin123';
bcrypt.hash(password, 10).then(hash => console.log(hash));
```

생성된 해시를 schema.sql 파일의 관리자 계정 INSERT 문에 넣어주세요.

### 2. Backend 설정

```bash
# backend 폴더로 이동
cd groupware/backend

# 패키지 설치
npm install

# .env 파일 생성 (.env.example 참고)
cp .env.example .env

# .env 파일 수정
# 1. DB_PASSWORD를 실제 MariaDB 비밀번호로 변경
# 2. JWT_SECRET을 랜덤 문자열로 변경 (아래 명령어로 생성 가능)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
nano .env
```

**.env 필수 수정 항목:**
```env
DB_PASSWORD=your_actual_password                    # MariaDB 비밀번호
JWT_SECRET=랜덤_생성된_긴_문자열                     # 위 명령어로 생성
SESSION_SECRET=또다른_랜덤_문자열                    # 위 명령어로 생성
```

```bash
# uploads 폴더 생성
mkdir uploads

# 서버 실행
npm run dev
```

### 3. Frontend 설정

```bash
# frontend 폴더로 이동
cd ../frontend

# 패키지 설치
npm install

# 환경 변수 파일 생성
cp .env.example .env

# 앱 실행
npm start
```

**참고**: 
- `npm install` 시 모든 필요한 패키지가 자동으로 설치됩니다
- package.json에 react, react-router-dom, axios 등이 이미 포함되어 있습니다
- 브라우저가 자동으로 http://localhost:3000 으로 열립니다

## ✅ 실행 확인

### Backend
```bash
# 브라우저에서 접속
http://localhost:5001/

# 응답 확인
{
  "message": "그룹웨어 API 서버",
  "version": "1.0.0",
  "status": "running"
}

# Health Check
http://localhost:5001/health
```

### Frontend
```bash
# 브라우저에서 접속
http://localhost:3000/

# 로그인 페이지가 표시되어야 함
```

## 🔐 기본 로그인 정보

```
아이디: admin
비밀번호: admin123
```

## 📝 Phase 1 완료 체크리스트

- [x] 데이터베이스 스키마 생성
- [x] Backend 기본 구조 설정
- [x] 인증 시스템 (로그인/로그아웃/토큰)
- [x] 사용자 관리 API
- [x] 부서 관리 API
- [x] Frontend 기본 레이아웃
- [x] 로그인 페이지
- [x] 대시보드
- [x] 헤더 & 사이드바
- [x] TossFace 폰트 적용

## 🔧 트러블슈팅

### 1. DB 연결 오류
```
Error: ER_ACCESS_DENIED_ERROR
```
→ .env 파일의 DB_PASSWORD 확인

### 2. bcrypt 오류 (Windows)
```
Error: Cannot find module 'bcrypt'
```
→ node-gyp 설치 필요
```bash
npm install --global --production windows-build-tools
npm rebuild bcrypt --build-from-source
```

### 3. CORS 오류
```
Access to XMLHttpRequest has been blocked by CORS policy
```
→ Backend .env의 CORS_ORIGIN 확인
→ Frontend .env의 REACT_APP_API_URL 확인

### 4. JWT 토큰 오류
```
Error: jwt malformed
```
→ localStorage의 token 삭제 후 재로그인

## 🎯 다음 단계: Phase 2

Phase 2에서는 게시판 모듈을 구현합니다:
- 게시판 목록 조회
- 게시글 CRUD
- 파일 업로드
- 댓글 기능
- 좋아요 기능

---

## 📞 문제가 있나요?

설치 또는 실행 중 문제가 발생하면 말씀해주세요!
