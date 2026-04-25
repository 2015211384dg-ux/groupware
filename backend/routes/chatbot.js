const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const fs      = require('fs');
const { spawn } = require('child_process');
const multer  = require('multer');
const db = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const RAG_URL  = process.env.RAG_SERVICE_URL || 'http://localhost:8001';
const DOCS_DIR = path.resolve(__dirname, '../../rag_service/docs');
const RAG_DIR  = path.resolve(__dirname, '../../rag_service');
const VENV_PYTHON = path.join(RAG_DIR, 'venv/Scripts/python.exe');

// 문서 업로드 multer 설정
const upload = multer({
    dest: DOCS_DIR,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.doc', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('PDF, DOCX, TXT 파일만 업로드 가능합니다.'));
    },
});

// 재인덱싱 헬퍼 (비동기 실행)
function runIngest() {
    return new Promise((resolve, reject) => {
        const proc = spawn(VENV_PYTHON, ['ingest.py', '--docs_dir', './docs'], {
            cwd: RAG_DIR,
            windowsHide: true,
        });
        let out = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.stderr.on('data', d => { out += d.toString(); });
        proc.on('close', code => {
            if (code === 0) resolve(out);
            else reject(new Error(out || `ingest 종료 코드: ${code}`));
        });
    });
}

// RAG 서비스 호출 헬퍼
async function callRag(endpoint, body) {
    const res = await fetch(`${RAG_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000), // 180초 (모델 첫 로딩 포함)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `RAG 서비스 오류 (${res.status})`);
    }
    return res.json();
}

// ── RAG 서비스 상태 확인 ───────────────────────────────
router.get('/health', authMiddleware, async (req, res) => {
    try {
        const response = await fetch(`${RAG_URL}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        res.json(data);
    } catch {
        res.status(503).json({ status: 'offline', chroma_ready: false });
    }
});

// ── 새 세션 생성 ──────────────────────────────────────
router.post('/sessions', authMiddleware, async (req, res) => {
    try {
        const sessionId = uuidv4();
        await db.execute(
            'INSERT INTO chatbot_sessions (user_id, session_id) VALUES (?, ?)',
            [req.user.id, sessionId]
        );
        res.json({ session_id: sessionId });
    } catch (err) {
        console.error('[chatbot] 세션 생성 오류:', err.message);
        res.status(500).json({ message: '세션을 생성하지 못했습니다.' });
    }
});

// ── 내 세션 목록 ──────────────────────────────────────
router.get('/sessions', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT session_id, title, updated_at
             FROM chatbot_sessions
             WHERE user_id = ?
             ORDER BY updated_at DESC
             LIMIT 20`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error('[chatbot] 세션 목록 오류:', err.message);
        res.status(500).json({ message: '세션 목록을 불러오지 못했습니다.' });
    }
});

// ── 세션 메시지 조회 ──────────────────────────────────
router.get('/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const [sessions] = await db.execute(
            'SELECT id FROM chatbot_sessions WHERE session_id = ? AND user_id = ?',
            [sessionId, req.user.id]
        );
        if (!sessions.length) return res.status(403).json({ message: '접근 권한이 없습니다.' });

        const [messages] = await db.execute(
            `SELECT id, role, content, sources, created_at
             FROM chatbot_messages
             WHERE session_id = ?
             ORDER BY created_at ASC`,
            [sessionId]
        );
        res.json(messages.map(m => ({
            ...m,
            sources: m.sources ? JSON.parse(m.sources) : [],
        })));
    } catch (err) {
        console.error('[chatbot] 메시지 조회 오류:', err.message);
        res.status(500).json({ message: '메시지를 불러오지 못했습니다.' });
    }
});

// ── 메시지 전송 (핵심) ────────────────────────────────
router.post('/sessions/:sessionId/chat', authMiddleware, async (req, res) => {
    const { sessionId } = req.params;
    const { message }   = req.body;

    if (!message?.trim()) {
        return res.status(400).json({ message: '메시지를 입력해 주세요.' });
    }

    try {
        // 본인 세션 확인
        const [sessions] = await db.execute(
            'SELECT id, title FROM chatbot_sessions WHERE session_id = ? AND user_id = ?',
            [sessionId, req.user.id]
        );
        if (!sessions.length) return res.status(403).json({ message: '접근 권한이 없습니다.' });

        // 최근 대화 이력 조회 (최대 12개)
        const [prevMessages] = await db.execute(
            `SELECT role, content FROM chatbot_messages
             WHERE session_id = ? ORDER BY created_at DESC LIMIT 12`,
            [sessionId]
        );
        const history = prevMessages.reverse().map(m => ({ role: m.role, content: m.content }));

        // 유저 메시지 저장
        await db.execute(
            'INSERT INTO chatbot_messages (session_id, role, content) VALUES (?, ?, ?)',
            [sessionId, 'user', message.trim()]
        );

        // RAG 서비스 호출
        const result = await callRag('/chat', { message: message.trim(), history });

        // 어시스턴트 응답 저장
        const [inserted] = await db.execute(
            'INSERT INTO chatbot_messages (session_id, role, content, sources) VALUES (?, ?, ?, ?)',
            [sessionId, 'assistant', result.answer, JSON.stringify(result.sources)]
        );
        const messageId = inserted.insertId;

        // 세션 제목 설정 (최초 1회)
        if (!sessions[0].title) {
            await db.execute(
                'UPDATE chatbot_sessions SET title = ? WHERE session_id = ?',
                [message.trim().substring(0, 50), sessionId]
            );
        }

        // updated_at 갱신
        await db.execute(
            'UPDATE chatbot_sessions SET updated_at = NOW() WHERE session_id = ?',
            [sessionId]
        );

        res.json({
            message_id:    messageId,
            answer:        result.answer,
            sources:       result.sources,
            found_context: result.found_context,
        });

    } catch (err) {
        console.error('[chatbot] 채팅 오류:', err.message);

        if (err.message.includes('RAG 서비스') || err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
        }
        res.status(500).json({ message: '답변을 생성하지 못했습니다.' });
    }
});

// ── 메시지 피드백 (👍👎) ───────────────────────────────
router.post('/messages/:messageId/feedback', authMiddleware, async (req, res) => {
    const { messageId } = req.params;
    const { rating }    = req.body;  // 'up' | 'down'

    if (!['up', 'down'].includes(rating)) {
        return res.status(400).json({ message: '올바르지 않은 평가입니다.' });
    }

    try {
        await db.execute(
            `INSERT INTO chatbot_feedback (message_id, user_id, rating)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
            [messageId, req.user.id, rating]
        );
        res.json({ message_id: Number(messageId), rating });
    } catch (err) {
        console.error('[chatbot] 피드백 저장 오류:', err.message);
        res.status(500).json({ message: '피드백을 저장하지 못했습니다.' });
    }
});

// ── 세션 삭제 ─────────────────────────────────────────
router.delete('/sessions/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const [result] = await db.execute(
            'DELETE FROM chatbot_sessions WHERE session_id = ? AND user_id = ?',
            [sessionId, req.user.id]
        );
        if (!result.affectedRows) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });

        await db.execute('DELETE FROM chatbot_messages WHERE session_id = ?', [sessionId]);
        res.json({ message: '삭제되었습니다.' });
    } catch (err) {
        console.error('[chatbot] 세션 삭제 오류:', err.message);
        res.status(500).json({ message: '세션을 삭제하지 못했습니다.' });
    }
});

// ── 관리자: 문서 목록 조회 ────────────────────────────
router.get('/docs', authMiddleware, adminMiddleware, (req, res) => {
    try {
        if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
        const files = fs.readdirSync(DOCS_DIR)
            .filter(f => ['.pdf','.docx','.doc','.txt'].includes(path.extname(f).toLowerCase()))
            .map(f => {
                const stat = fs.statSync(path.join(DOCS_DIR, f));
                return { name: f, size: stat.size, modified_at: stat.mtime };
            });
        res.json(files);
    } catch (err) {
        console.error('[chatbot] 문서 목록 오류:', err.message);
        res.status(500).json({ message: '문서 목록을 불러오지 못했습니다.' });
    }
});

// ── 관리자: 문서 업로드 + 자동 재인덱싱 ──────────────
router.post('/docs/upload', authMiddleware, adminMiddleware,
    upload.single('file'),
    async (req, res) => {
        if (!req.file) return res.status(400).json({ message: '파일이 없습니다.' });
        const ext  = path.extname(req.file.originalname).toLowerCase();
        const dest = path.join(DOCS_DIR, req.file.originalname);
        try {
            // multer가 임시 저장한 파일을 원본 파일명으로 이동
            fs.renameSync(req.file.path, dest);
            // 재인덱싱 (백그라운드, 응답은 즉시 반환)
            runIngest().catch(e => console.error('[chatbot] ingest 오류:', e.message));
            res.json({ message: '업로드 완료. 인덱싱이 시작됩니다.', filename: req.file.originalname });
        } catch (err) {
            fs.unlink(req.file.path, () => {});
            console.error('[chatbot] 업로드 오류:', err.message);
            res.status(500).json({ message: '파일 업로드에 실패했습니다.' });
        }
    }
);

// ── 관리자: 문서 삭제 + 재인덱싱 ─────────────────────
router.delete('/docs/:filename', authMiddleware, adminMiddleware, async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(DOCS_DIR, filename);
    try {
        if (!fs.existsSync(filePath)) return res.status(404).json({ message: '파일을 찾을 수 없습니다.' });
        fs.unlinkSync(filePath);
        runIngest().catch(e => console.error('[chatbot] ingest 오류:', e.message));
        res.json({ message: '삭제 완료. 인덱싱이 시작됩니다.' });
    } catch (err) {
        console.error('[chatbot] 삭제 오류:', err.message);
        res.status(500).json({ message: '파일 삭제에 실패했습니다.' });
    }
});

// ── 관리자: 수동 재인덱싱 ─────────────────────────────
router.post('/docs/reindex', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await runIngest();
        res.json({ message: '재인덱싱이 완료됐습니다.', detail: result.split('\n').slice(-3).join(' ') });
    } catch (err) {
        console.error('[chatbot] 재인덱싱 오류:', err.message);
        res.status(500).json({ message: '재인덱싱에 실패했습니다.', detail: err.message });
    }
});

module.exports = router;
