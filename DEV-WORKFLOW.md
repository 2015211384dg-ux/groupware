# 개발 워크플로우 가이드

> 운영 서버 마이그레이션 이후 유지보수 및 오류 수정 절차

---

## 전체 흐름

```
운영 서버 오류 발생
      ↓
pm2 logs 로 원인 파악
      ↓
운영 DB 덤프 → 개발 PC에 복원
      ↓
개발 PC에서 실데이터로 재현 및 수정
      ↓
정상 확인 후 dev 브랜치 푸시
      ↓
main 머지 → 운영 서버 자동 배포
```

---

## 1. 운영 DB를 개발 PC로 복사하는 방법

### 1-1. 운영 서버에서 DB 덤프

운영 서버에 접속하여 아래 명령어 실행:

```powershell
mysqldump -u root -p -P 3300 groupware > C:\backup\groupware_prod.sql
```

또는 자동 백업 파일이 있다면 (`C:\backup\db_YYYYMMDD.sql`) 그대로 활용합니다.

### 1-2. 덤프 파일을 개발 PC로 복사

**방법 A: 공유 폴더 / USB**
- 운영 서버의 백업 파일을 공유 폴더나 USB로 개발 PC에 복사

**방법 B: 내부망 SCP (Git Bash 사용)**
```bash
# 개발 PC의 Git Bash에서 실행
scp 사용자명@운영서버IP:C:/backup/groupware_prod.sql C:/dev-db/groupware_prod.sql
```

### 1-3. 개발 PC MariaDB에 복원

개발 PC에 별도 DB(`groupware_dev`)를 만들어 운영 데이터를 넣습니다.
운영 DB(`groupware`)와 분리해서 관리합니다.

```powershell
# MariaDB 접속
mariadb -u root -p -P 3300

# 개발용 DB 생성 (처음 한 번만)
CREATE DATABASE groupware_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 덤프 파일 복원
mariadb -u root -p -P 3300 groupware_dev < C:\dev-db\groupware_prod.sql
```

### 1-4. 개발 PC .env 파일 수정

`C:\groupware\backend\.env` 에서 DB 이름을 개발용으로 변경:

```env
# 개발 PC .env
DB_NAME=groupware_dev    ← groupware_prod 데이터를 바라봄
```

> 운영 서버의 `.env` 는 `DB_NAME=groupware` 그대로 유지합니다.

### 1-5. 백엔드 재시작

```powershell
# 개발 PC에서 (PM2 또는 직접 실행)
pm2 restart groupware-backend

# 또는 개발 모드로 직접 실행
cd C:\groupware\backend
node server.js
```

이제 개발 PC에서 `http://localhost:3000` 접속 시 **운영 실데이터 기반**으로 테스트할 수 있습니다.

---

## 2. 개발 PC .env 관리 주의사항

운영 서버와 개발 PC의 `.env` 는 다르게 유지합니다.

| 항목 | 개발 PC | 운영 서버 |
|------|---------|----------|
| `DB_NAME` | `groupware_dev` | `groupware` |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | `3000` |
| `JWT_SECRET` | 개발용 (달라도 됨) | 운영용 고정값 |

> `.env` 는 Git에 올라가지 않으므로 각 환경에서 따로 관리합니다.

---

## 3. 오류 수정 후 배포 절차

```
1. 개발 PC에서 실데이터로 오류 재현 확인
       ↓
2. 코드 수정
       ↓
3. 로컬 테스트 통과
       ↓
4. dev 브랜치에 푸시
       ↓
5. main 브랜치에 머지
       ↓
6. 운영 서버 자동 배포 (GitHub Actions)
       ↓
7. 운영 서버 pm2 logs 로 정상 확인
```

### Git 브랜치 운영 방식

```bash
# 오류 수정 시작
git checkout -b fix/오류명

# 수정 후 커밋
git add .
git commit -m "fix: 오류 내용 설명"

# dev 브랜치에 머지
git checkout dev
git merge fix/오류명

# 검증 완료 후 main에 머지 → 운영 자동 배포
git checkout main
git merge dev
git push origin main
```

---

## 4. 개발 PC DB 최신화 주기

운영 데이터는 계속 쌓이므로 주기적으로 덤프를 갱신합니다.

| 상황 | 갱신 권장 |
|------|----------|
| 오류 수정 시작 전 | 매번 최신 덤프로 갱신 |
| 신규 기능 개발 | 월 1회 이상 |
| 데이터 구조 변경 (스키마) | 반드시 최신 덤프 후 테스트 |

---

## 5. 개인정보 주의사항

운영 DB에는 실제 직원 정보(이름, 이메일 등)가 포함됩니다.

- 덤프 파일(`groupware_prod.sql`)을 외부 유출 금지
- 개발 PC 잠금 화면 설정 필수
- 테스트 완료 후 덤프 파일 삭제 권장

```powershell
# 테스트 완료 후 덤프 파일 삭제
del C:\dev-db\groupware_prod.sql
```
