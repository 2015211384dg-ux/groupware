# 개발 PC → 운영 서버 배포 절차

> 개발 PC에서 코드 수정 후 운영 서버에 반영하는 전체 흐름  
> 운영 서버 최초 세팅은 [DEPLOYMENT.md](./DEPLOYMENT.md) 참조

---

## 전체 흐름

```
개발 PC
  ① 코드 수정 + 로컬 테스트
  ② git add → git commit → git push (main)
          ↓
      GitHub 저장소
          ↓
      GitHub Actions 트리거
          ↓
  운영 서버 Self-hosted Runner
  ③ git pull
  ④ npm run build (프론트 변경 시)
  ⑤ pm2 restart --update-env
          ↓
      운영 서버 반영 완료
```

---

## 1. 개발 PC에서 코드 수정 후 푸시

```bash
# 변경 파일 확인
git status
git diff

# 스테이징 (파일 명시 권장 — .env, 비밀번호 실수 방지)
git add backend/routes/auth.js frontend/src/App.js

# 커밋
git commit -m "fix: 오류 내용 설명"

# 푸시 (main 브랜치)
git push origin main
```

> **주의: 절대 커밋하지 않을 파일**  
> `.env`, `backend/backup/my-backup.cnf`, `backend/uploads/` 디렉토리  
> (`.gitignore`에 포함되어 있지만 매번 `git status`로 확인)

---

## 2. GitHub Actions 자동 배포 설정 (최초 1회)

### 2-1. 운영 서버에 Self-hosted Runner 설치

1. GitHub 저장소 → **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. OS: **Windows** 선택 후 안내 명령어를 운영 서버 PowerShell에서 실행

```powershell
mkdir C:\actions-runner
cd C:\actions-runner
# GitHub에서 복사한 실제 명령어 실행
.\config.cmd --url https://github.com/2015211384dg-ux/groupware --token 발급된토큰
```

3. 서비스로 등록 (재부팅 후 자동 시작):

```powershell
.\svc.cmd install
.\svc.cmd start
```

### 2-2. 워크플로우 파일 생성

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
        run: pm2 restart groupware-backend --update-env

      - name: 배포 확인
        run: |
          Start-Sleep -Seconds 3
          $res = Invoke-WebRequest -Uri "http://localhost:5001/health" -UseBasicParsing
          if ($res.StatusCode -ne 200) { exit 1 }
          Write-Host "✅ 배포 성공"
```

### 2-3. 워크플로우 파일 푸시

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: GitHub Actions 자동 배포 설정"
git push origin main
```

이후부터는 `git push` 만 하면 운영 서버에 자동 반영됩니다.

---

## 3. 수동 배포 (GitHub Actions 미설정 시)

운영 서버에서 직접 실행:

```powershell
cd C:\groupware

# 코드 최신화
git pull origin main

# 프론트엔드가 바뀐 경우
cd C:\groupware\frontend
npm run build
cd C:\groupware

# 백엔드 재시작 (환경변수 포함 — .env 변경 시 필수)
pm2 restart groupware-backend --update-env

# 정상 확인
pm2 logs groupware-backend --lines 20 --nostream
```

---

## 4. DB 스키마 변경이 있는 경우

server.js의 `db.query('CREATE TABLE IF NOT EXISTS ...')` 와 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` 구문이 서버 재시작 시 자동으로 실행됩니다.

별도 마이그레이션 스크립트 없이 `pm2 restart` 만으로 반영됩니다.

**확인 방법:**

```powershell
pm2 logs groupware-backend --lines 30 --nostream
# 오류 없이 "✅ 데이터베이스 연결 성공" 이 보이면 정상
```

---

## 5. .env 변경이 있는 경우

운영 서버의 `.env` 파일을 **직접 편집**한 후 재시작:

```powershell
# .env 편집 (메모장 또는 VS Code)
notepad C:\groupware\backend\.env

# 환경변수 반영하여 재시작 (--update-env 필수)
pm2 restart groupware-backend --update-env

# 변경된 값 확인 (민감 정보 노출 주의)
pm2 env groupware-backend
```

> `.env`는 Git에 올리지 않으므로 운영 서버에서만 관리합니다.  
> 변경 내용은 별도 문서나 안전한 저장소에 기록해두세요.

---

## 6. 배포 후 확인 체크리스트

```powershell
# 1. PM2 상태
pm2 list
# groupware-backend, groupware-frontend 모두 online 확인

# 2. 최근 로그 오류 없음 확인
pm2 logs groupware-backend --lines 20 --nostream | Select-String "error|Error|오류|실패" -NotMatch

# 3. 헬스체크
Invoke-WebRequest -Uri "http://localhost:5001/health" -UseBasicParsing

# 4. 브라우저에서 접속 확인
# http://운영서버IP:3000 → 로그인 화면
```

---

## 7. 배포 실패 시 롤백

```bash
# 개발 PC에서 이전 커밋으로 되돌리기
git revert HEAD
git push origin main
```

GitHub Actions 설정이 되어 있으면 revert 푸시만으로 운영 서버도 자동 롤백됩니다.

수동 롤백:

```powershell
# 운영 서버에서
cd C:\groupware
git revert HEAD
npm run build  # 프론트 변경 포함된 경우
pm2 restart groupware-backend --update-env
```

---

## 참고 문서

| 문서 | 용도 |
|------|------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 신규 서버 최초 세팅 전체 절차 |
| [DEV-WORKFLOW.md](./DEV-WORKFLOW.md) | 운영 DB → 개발 PC 복원 절차 |
| [docs/iso27001/BACKUP-RECOVERY.md](docs/iso27001/BACKUP-RECOVERY.md) | 백업/복구 상세 절차 |
| [docs/iso27001/INCIDENT-RESPONSE.md](docs/iso27001/INCIDENT-RESPONSE.md) | 장애 발생 시 대응 절차 |
