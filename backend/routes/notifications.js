const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

router.use(authMiddleware);

// ============================================
// 미읽은 알림 폴링 (데스크탑 앱용)
// GET /notifications/unread?since=ISO_TIMESTAMP
// ============================================
router.get('/unread', async (req, res) => {
    try {
        // since가 없으면 24시간 전부터
        const since = req.query.since
            ? new Date(req.query.since)
            : new Date(Date.now() - 24 * 60 * 60 * 1000);

        // 일반 알림 (게시글/댓글/피드백)
        const [general] = await db.query(
            `SELECT 'general' AS source, id, type, title, body, url, created_at
             FROM notifications
             WHERE user_id = ? AND is_read = 0 AND created_at > ?
             ORDER BY created_at DESC`,
            [req.user.id, since]
        );

        // 결재 알림
        const [approval] = await db.query(
            `SELECT 'approval' AS source, n.id, n.type,
                    n.message AS title, NULL AS body,
                    CASE WHEN n.type = 'AR' THEN n.url
                         ELSE CONCAT('/approval/documents/', n.document_id)
                    END AS url,
                    n.created_at
             FROM approval_notifications n
             WHERE n.user_id = ? AND n.is_read = FALSE AND n.created_at > ?
             ORDER BY n.created_at DESC`,
            [req.user.id, since]
        );

        const all = [...general, ...approval].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        res.json({ success: true, data: all });
    } catch (err) {
        console.error('notifications/unread error:', err);
        res.status(500).json({ success: false });
    }
});

// ============================================
// 알림 읽음 처리
// PATCH /notifications/read  { source, id }
// ============================================
router.patch('/read', async (req, res) => {
    try {
        const { source, id } = req.body;
        if (source === 'approval') {
            await db.query(
                'UPDATE approval_notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
                [id, req.user.id]
            );
        } else {
            await db.query(
                'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
                [id, req.user.id]
            );
        }
        res.json({ success: true });
    } catch { res.status(500).json({ success: false }); }
});

// ============================================
// 전체 읽음 처리
// PATCH /notifications/read-all
// ============================================
router.patch('/read-all', async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
        await db.query('UPDATE approval_notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
        res.json({ success: true });
    } catch { res.status(500).json({ success: false }); }
});

module.exports = router;
