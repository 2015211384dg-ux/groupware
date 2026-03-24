const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

router.use(authMiddleware);

// ============================================
// 대시보드 통계 조회
// ============================================
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. 미확인 공지사항 개수 (30일 이내)
        const [noticeResult] = await db.query(`
            SELECT COUNT(*) as count
            FROM posts p
            WHERE p.is_notice = TRUE
            AND p.is_deleted = FALSE
            AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND p.id NOT IN (
                SELECT post_id
                FROM post_views
                WHERE user_id = ?
            )
        `, [userId]);

        // 2. 내가 쓴 글 개수 (30일 이내)
        const [myPostsResult] = await db.query(`
            SELECT COUNT(*) as count
            FROM posts
            WHERE user_id = ? AND is_deleted = FALSE
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `, [userId]);

        // 3. 새 댓글 개수 (내 글에 달린 댓글, 30일 이내)
        const [newCommentsResult] = await db.query(`
            SELECT COUNT(DISTINCT c.id) as count
            FROM comments c
            JOIN posts p ON c.post_id = p.id
            WHERE p.user_id = ?
            AND c.user_id != ?
            AND c.is_deleted = FALSE
            AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND c.created_at > (
                SELECT COALESCE(MAX(last_check), '2000-01-01')
                FROM comment_checks
                WHERE user_id = ?
            )
        `, [userId, userId, userId]);

        // 4. 결재 대기 (내가 결재해야 할 건, 30일 이내, CANCELLED 제외)
        const [tasksResult] = await db.query(`
            SELECT COUNT(*) as count
            FROM approval_lines al
            JOIN approval_documents ad ON al.document_id = ad.id
            WHERE al.approver_id = ?
            AND al.status = 'PENDING'
            AND ad.status NOT IN ('CANCELLED')
            AND ad.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `, [userId]);

        // 5. 최근 공지사항 (상위 5개)
        const [recentNotices] = await db.query(`
            SELECT p.id, p.title, p.created_at, p.category,
                   u.name as author_name,
                   b.name as board_name,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND is_deleted = FALSE) as comment_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN boards b ON p.board_id = b.id
            WHERE p.is_deleted = FALSE
            ORDER BY p.created_at DESC
            LIMIT 5
        `);

        console.log('📋 최근 공지사항 조회:', recentNotices.length, '개');

        res.json({
            success: true,
            data: {
                unreadNotices: noticeResult[0].count,
                myPosts: myPostsResult[0].count,
                newComments: newCommentsResult[0].count,
                ongoingTasks: tasksResult[0].count,
                recentNotices: recentNotices
            }
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: '대시보드 통계 조회에 실패했습니다.'
        });
    }
});

module.exports = router;
