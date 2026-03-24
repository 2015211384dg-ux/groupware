const express = require('express');
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const db = require('../config/database');
const { createNotification } = require('../utils/notificationHelper');

const STATUS_LABELS = {
    pending: '접수됨', reviewing: '검토 중', resolved: '처리완료', hold: '보류'
};

router.use(authMiddleware);

// ============================================
// 피드백 제출 (모든 사용자)
// ============================================
router.post('/', async (req, res) => {
    try {
        const { type, title, content } = req.body;
        if (!title?.trim() || !content?.trim()) {
            return res.status(400).json({ success: false, message: '제목과 내용을 입력해주세요.' });
        }
        const validTypes = ['bug', 'improvement', 'inconvenience', 'other'];
        const feedbackType = validTypes.includes(type) ? type : 'other';

        const [result] = await db.query(
            'INSERT INTO feedback (user_id, type, title, content) VALUES (?, ?, ?, ?)',
            [req.user.id, feedbackType, title.trim(), content.trim()]
        );
        logActivity('info', `피드백 제출: "${title}" (유형: ${feedbackType}, 작성자: ${req.user.name})`, { userId: req.user.id, req });
        res.status(201).json({ success: true, message: '피드백이 등록되었습니다.', data: { id: result.insertId } });
    } catch (error) {
        console.error('Feedback submit error:', error.message, error.code);
        res.status(500).json({ success: false, message: '피드백 등록 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 내 피드백 목록
// ============================================
router.get('/mine', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, type, title, content, status, admin_note, created_at
             FROM feedback WHERE user_id = ? ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: '조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 전체 피드백 목록 (관리자)
// ============================================
router.get('/', checkRole('SUPER_ADMIN', 'HR_ADMIN'), async (req, res) => {
    try {
        const { status, type } = req.query;
        let query = `
            SELECT f.*, u.name as user_name, u.username
            FROM feedback f
            JOIN users u ON f.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        if (status) { query += ' AND f.status = ?'; params.push(status); }
        if (type)   { query += ' AND f.type = ?';   params.push(type); }
        query += ' ORDER BY f.created_at DESC';

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: '조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 피드백 상태/메모 업데이트 (관리자)
// ============================================
router.patch('/:id', checkRole('SUPER_ADMIN', 'HR_ADMIN'), async (req, res) => {
    try {
        const { status, admin_note } = req.body;
        const validStatuses = ['pending', 'reviewing', 'resolved', 'hold'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: '올바르지 않은 상태값입니다.' });
        }
        await db.query(
            'UPDATE feedback SET status = COALESCE(?, status), admin_note = COALESCE(?, admin_note) WHERE id = ?',
            [status || null, admin_note ?? null, req.params.id]
        );

        // 상태가 변경된 경우 제출자에게 알림
        if (status) {
            const [[fb]] = await db.query('SELECT user_id, title FROM feedback WHERE id = ?', [req.params.id]);
            if (fb) {
                createNotification(fb.user_id, {
                    type: 'feedback',
                    title: '피드백 상태 변경',
                    body: `"${fb.title}" 피드백이 [${STATUS_LABELS[status] || status}](으)로 변경되었습니다.`,
                    url: '/feedback'
                });
            }
        }

        res.json({ success: true, message: '업데이트되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: '업데이트 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
