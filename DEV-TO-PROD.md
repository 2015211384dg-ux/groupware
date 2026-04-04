# 개발 PC → 운영 서버 배포 절차

> 개발 PC에서 코드 수정 후 운영 서버에 반영하는 전체 흐름

---

## 전체 흐름

```
개발 PC
  → 코드 수정 + 로컬 테스트
  → git push (main 브랜치)
        ↓
    GitHub 저장소
        ↓
    GitHub Actions 트리거
        ↓
운영 서버 Self-hosted Runner 감지
  → git pull
  → npm run build (프론트 변경 시)
  → pm2 restart
        ↓
    운영 서버 자동 반영 완료
```

---

## 1. 개발 PC에서 코드 수정 후 푸시

```bash
# 변경 파일 확인
git status

# 스테이징
git add 파일명
# 또는 전체
git add .

# 커밋
git commit -m "fix: 오류 내용 설명"

# 푸시 (main 브랜치)
git push origin main
```

푸시 즉시 GitHub Actions가 트리거되어 운영 서버에 자동 반영됩니다.

---

## 2. GitHub Actions 자동 배포 설정 (최초 1회)

### 2-1. 운영 서버에 Self-hosted Runner 설치

1. GitHub 저장소 → **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. OS: **Windows** 선택
3. 안내 명령어를 운영 서버 PowerShell에서 순서대로 실행

```powershell
# 예시 (GitHub에서 실제 명령어 복사할 것)
mkdir C:\actions-runner; cd C:\actions-runner
.\config.cmd --url https://github.com/2015211384dg-ux/groupware --token 발급된토큰
```

4. 서비스로 등록 (서버 재부팅 후에도 자동 시작):

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
        run: pm2 restart groupware-backend
```

### 2-3. 워크플로우 파일 푸시

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: GitHub Actions 자동 배포 설정"
git push origin main
```

이후부터는 `git push` 만 하면 운영 서버에 자동 반영됩니다.

---

## 3. 자동 배포 미설정 시 수동 배포

GitHub Actions 없이 수동으로 반영할 경우 운영 서버에서 직접 실행:

```powershell
# 운영 서버에서
cd C:\groupware

# 코드 최신화
git pull origin main

# 프론트엔드가 바뀐 경우
cd frontend
npm run build
cd ..

# 백엔드 재시작
pm2 restart groupware-backend
```

---

## 4. 배포 후 운영 서버 확인

```powershell
# 서버 상태 확인
pm2 list

# 실시간 로그 (오류 없는지 확인)
pm2 logs groupware-backend --lines 30

# 에러만 보기
pm2 logs groupware-backend --err --lines 30
```

정상이면 로그에 에러 없이 요청 로그만 찍힙니다.

---

## 5. 배포 실패 시 롤백

```bash
# 이전 커밋으로 되돌리기
git revert HEAD
git push origin main
```

자동 배포가 설정되어 있으면 revert 푸시만으로 운영 서버도 자동 롤백됩니다.
