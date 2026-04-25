# 사내 AI 규정 챗봇 환경 세팅 가이드

> 현재 서버 환경 기준으로 작성됨 (2026-04-15)
>
> - OS: Windows 11 Enterprise
> - Node.js: v22.22.2 ✅
> - Python: 3.13.5 ✅
> - GPU: Radeon RX 570 (4GB VRAM, AMD) ⚠️
> - Ollama: 미설치 ❌

---

## 전체 구조

```
React (포트 3000)
    ↓ /api/v1/chatbot/*
Node.js Express (포트 3000)
    ↓ http://localhost:8001
Python FastAPI RAG 서비스 (포트 8001)
    ↓ LLM 추론          ↓ 임베딩
Ollama (Gemma 4 4B)    Ollama (bge-m3)
    ↓
ChromaDB (로컬 파일 저장)
```

---

## ⚠️ GPU 주의사항 (필독)

현재 서버의 GPU는 **AMD Radeon RX 570 (Polaris 아키텍처)** 입니다.

Ollama의 Windows AMD GPU 가속(ROCm)은 **RDNA2 이상** (RX 6000 시리즈~) 을 지원합니다.
RX 570은 이보다 구형이므로 **CPU 모드로 동작**합니다.

| 모드 | 조건 | 예상 응답속도 |
|------|------|--------------|
| GPU 가속 | RDNA2+ (RX 6000~) | 2~5초 |
| **CPU 모드 (현재)** | **RX 570 (GCN)** | **20~40초** |

→ **Gemma 4 4B 모델 사용 권장** (12B는 CPU 모드에서 응답 1~2분 소요)
→ RAM이 16GB 이상이면 CPU 모드도 충분히 동작함

---

## STEP 1 — 폴더 구조 생성

명령 프롬프트(CMD) 또는 PowerShell에서 실행:

```cmd
mkdir C:\groupware\rag_service
mkdir C:\groupware\rag_service\docs
```

`docs` 폴더에 규정 문서를 넣을 예정입니다.
- 지원 형식: `.pdf`, `.docx`, `.doc`, `.txt`
- 예시: `취업규칙.pdf`, `보안정책.docx`, `복리후생안내.pdf`

---

## STEP 2 — Ollama 설치

### 2-1. 설치 파일 다운로드

[https://ollama.com/download](https://ollama.com/download) 에서 **Windows** 버전 다운로드 후 설치

설치 후 시스템 트레이에 Ollama 아이콘이 생기며 자동 실행됩니다.
(포트 11434에서 대기)

### 2-2. 설치 확인

```cmd
ollama --version
```

정상이면 버전 번호 출력됩니다.

### 2-3. 모델 다운로드

```cmd
:: LLM 모델 (약 3GB, CPU 모드 기준 4B 권장)
ollama pull gemma4:4b

:: 한국어 임베딩 모델 (약 600MB)
ollama pull bge-m3
```

> `gemma4:4b` 이름이 없을 경우 → `ollama.com/library` 에서 정확한 태그 확인
> (예: `gemma3:4b` 등 출시 버전에 따라 다를 수 있음)

### 2-4. 모델 확인

```cmd
ollama list
```

아래와 같이 출력되면 정상:

```
NAME            ID              SIZE    MODIFIED
gemma4:4b       xxxxxxxxxxxx    2.5 GB  ...
bge-m3          xxxxxxxxxxxx    590 MB  ...
```

### 2-5. 동작 테스트

```cmd
ollama run gemma4:4b "안녕하세요, 간단히 자기소개 해주세요."
```

한국어로 응답이 오면 완료입니다. (`Ctrl+D` 또는 `/bye` 로 종료)

---

## STEP 3 — Python 가상환경 생성

PowerShell 또는 Git Bash에서 실행:

```bash
cd C:/groupware/rag_service

# 가상환경 생성
python -m venv venv

# 가상환경 활성화 (Git Bash)
source venv/Scripts/activate

# 가상환경 활성화 (PowerShell / CMD)
venv\Scripts\activate
```

활성화되면 프롬프트 앞에 `(venv)` 표시가 붙습니다.

---

## STEP 4 — Python 패키지 설치

> 가상환경이 활성화된 상태에서 실행

이 단계에서는 `requirements.txt` 파일이 필요합니다. (다음 단계에서 코드와 함께 제공됩니다)

파일이 생성된 후:

```bash
cd C:/groupware/rag_service
pip install -r requirements.txt
```

설치 목록:
- `fastapi` — RAG 서비스 API 서버
- `uvicorn` — FastAPI 실행 서버
- `langchain` + `langchain-community` + `langchain-chroma` — RAG 파이프라인
- `chromadb` — 벡터 DB (로컬 파일)
- `pypdf` — PDF 문서 파싱
- `python-docx` — Word 문서 파싱
- `ollama` — Python에서 Ollama 호출

> 설치 시간: 약 5~10분 (최초 1회)

---

## STEP 5 — Node.js 패키지 추가 설치

```bash
cd C:/groupware/backend
npm install uuid
```

chatbot 세션 ID 생성에 사용됩니다.

---

## STEP 6 — MariaDB 테이블 생성

MariaDB에 접속 후 실행:

```bash
# 접속
mysql -u root -p -P 3300
```

```sql
USE groupware;

-- 채팅 세션 테이블
CREATE TABLE chatbot_sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  session_id  VARCHAR(36) NOT NULL UNIQUE,
  title       VARCHAR(200) NULL COMMENT '첫 질문을 세션 제목으로 사용',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 채팅 메시지 테이블
CREATE TABLE chatbot_messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(36) NOT NULL,
  role        ENUM('user', 'assistant') NOT NULL,
  content     TEXT NOT NULL,
  sources     JSON NULL COMMENT '출처 정보 배열',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## STEP 7 — .env 환경변수 추가

`C:\groupware\backend\.env` 파일에 추가:

```env
RAG_SERVICE_URL=http://localhost:8001
```

---

## STEP 8 — 문서 인제스트 실행

> RAG 서비스 코드(`ingest.py`)가 생성된 후 진행

`docs` 폴더에 규정 문서를 복사한 뒤:

```bash
cd C:/groupware/rag_service
source venv/Scripts/activate
python ingest.py --docs_dir ./docs
```

정상 실행 시 출력 예시:
```
[1/4] 문서 로드 중: ./docs
  로드 완료: 취업규칙.pdf (12페이지)
  로드 완료: 보안정책.docx (5페이지)
  총 17개 페이지 로드됨

[2/4] 청킹 중...
  총 84개 청크 생성됨

[3/4] 임베딩 및 ChromaDB 저장 중...
  ChromaDB 저장 완료: ./chroma_db

[4/4] 완료! 총 84개 청크가 인덱싱되었습니다.
```

> 문서를 추가하거나 수정할 때마다 이 명령을 다시 실행해야 합니다.

---

## STEP 9 — PM2 서비스 등록

`ecosystem.config.js`에 RAG 서비스 항목이 추가된 후:

```bash
cd C:/groupware

# 처음 등록
pm2 start ecosystem.config.js

# 이미 실행 중이면
pm2 reload ecosystem.config.js
```

### 상태 확인

```bash
pm2 status
```

아래 세 항목이 모두 `online` 상태여야 합니다:

```
┌────┬──────────────────────┬─────────┬──────┐
│ id │ name                 │ status  │ ...  │
├────┼──────────────────────┼─────────┼──────┤
│ 0  │ groupware-backend    │ online  │      │
│ 1  │ groupware-frontend   │ online  │      │
│ 2  │ rag-service          │ online  │      │
└────┴──────────────────────┴─────────┴──────┘
```

### RAG 서비스 로그 확인

```bash
pm2 logs rag-service --lines 50
```

---

## STEP 10 — 최종 동작 확인

### Ollama 확인

```bash
curl http://localhost:11434/api/tags
```

### RAG 서비스 헬스체크

```bash
curl http://localhost:8001/health
# 정상: {"status":"ok","chroma_ready":true}
```

### 브라우저 접속

```
http://10.18.10.70:3000/chatbot
```

---

## 문서 추가/업데이트 방법 (운영 중)

```bash
# 1. docs 폴더에 새 문서 복사
# 2. 인제스트 재실행
cd C:/groupware/rag_service
source venv/Scripts/activate
python ingest.py --docs_dir ./docs

# 3. RAG 서비스 재시작 (벡터DB 리로드)
pm2 restart rag-service
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ollama: command not found` | Ollama 미설치 | STEP 2 다시 진행 |
| `gemma4:4b` 모델 없음 | 이름 오류 | `ollama.com/library` 에서 정확한 태그 확인 |
| RAG 서비스 `503` | Python 서비스 미실행 | `pm2 logs rag-service` 확인 |
| `chroma_ready: false` | 인제스트 미실행 | STEP 8 실행 |
| 응답이 너무 느림 (1분+) | CPU 모드 + 12B 모델 | 4B 모델로 변경 후 `pm2 restart rag-service` |
| 한국어 검색 품질 낮음 | 임베딩 모델 문제 | `bge-m3` 설치 확인 후 인제스트 재실행 |
| `pip install` 실패 | 가상환경 미활성화 | `source venv/Scripts/activate` 먼저 실행 |

---

## 세팅 완료 체크리스트

- [ ] `C:\groupware\rag_service\` 폴더 생성
- [ ] `C:\groupware\rag_service\docs\` 에 규정 문서 복사
- [ ] Ollama 설치 및 `gemma4:4b`, `bge-m3` 모델 다운로드
- [ ] Python 가상환경 생성 및 패키지 설치
- [ ] `npm install uuid` (backend)
- [ ] MariaDB 테이블 2개 생성
- [ ] `backend/.env` 에 `RAG_SERVICE_URL` 추가
- [ ] 코드 파일 생성 (별도 진행)
- [ ] `python ingest.py` 실행 (문서 인덱싱)
- [ ] PM2 등록 및 `rag-service` 온라인 확인
- [ ] `/chatbot` 페이지 접속 확인
