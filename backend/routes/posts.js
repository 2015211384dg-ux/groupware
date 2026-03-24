const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const db = require('../config/database');
const { logActivity } = require('../utils/logger');
const { createNotification } = require('../utils/notificationHelper');

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// ============================================
// 게시글 목록 조회 (캐싱 5분)
// ============================================
router.get('/', cacheMiddleware(300), async (req, res) => {
    try {
        const {
            board_id,
            search,
            category,
            page = 1,
            limit = 20
        } = req.query;

        console.log('📋 게시글 목록 조회:', { board_id, search, category, page });

        const offset = (page - 1) * limit;

        const baseSelect = `
            SELECT p.*,
                   u.name as author_name,
                   e.position as author_position,
                   e.department_id as author_department_id,
                   d.name as department_name,
                   b.name as board_name,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND is_deleted = FALSE) as comment_count,
                   (SELECT COUNT(*) FROM attachments WHERE post_id = p.id) as attachment_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN boards b ON p.board_id = b.id
            WHERE p.is_deleted = FALSE
        `;

        const filterParams = [];
        let filterClause = '';
        if (board_id) { filterClause += ' AND p.board_id = ?'; filterParams.push(board_id); }
        if (category) { filterClause += ' AND p.category = ?'; filterParams.push(category); }
        if (search) { filterClause += ' AND (p.title LIKE ? OR p.content LIKE ?)'; filterParams.push(`%${search}%`, `%${search}%`); }

        // 고정글: 항상 모든 페이지에 표시 (페이지네이션 제외)
        const pinnedQuery = baseSelect + filterClause + ' AND p.is_pinned = TRUE ORDER BY p.created_at DESC';
        const [pinnedPosts] = await db.query(pinnedQuery, filterParams);

        // 일반글 개수 (고정글 제외)
        const countQuery = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM posts p
            WHERE p.is_deleted = FALSE AND p.is_pinned = FALSE
        ` + filterClause.replace(/AND p\./g, 'AND p.');
        const [countResult] = await db.query(countQuery, filterParams);
        const total = countResult[0].total;

        // 일반글 (고정글 제외, 공지 우선, 최신순)
        const regularQuery = baseSelect + filterClause + ' AND p.is_pinned = FALSE ORDER BY p.is_notice DESC, p.created_at DESC LIMIT ? OFFSET ?';
        const [posts] = await db.query(regularQuery, [...filterParams, parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            data: {
                pinnedPosts,
                posts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({
            success: false,
            message: '게시글 목록 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 게시글 고정/해제 (관리자 전용)
// ============================================
router.patch('/:id/pin', invalidateCache(/^api:.*\/api\/v1\/posts/), async (req, res) => {
    try {
        const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: '관리자만 게시글을 고정할 수 있습니다.' });
        }

        const [posts] = await db.query(
            'SELECT id, is_pinned FROM posts WHERE id = ? AND is_deleted = FALSE',
            [req.params.id]
        );
        if (!posts.length) {
            return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        }

        const newPinned = !posts[0].is_pinned;
        await db.query('UPDATE posts SET is_pinned = ? WHERE id = ?', [newPinned, req.params.id]);

        res.json({ success: true, data: { is_pinned: newPinned } });
    } catch (error) {
        console.error('Pin post error:', error);
        res.status(500).json({ success: false, message: '고정 처리 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 게시글 상세 조회 (캐싱 1분)
// ============================================
router.get('/:id', cacheMiddleware(60), async (req, res) => {
    try {
        const userId = req.user?.id;
        
        // 조회수 증가
        await db.query(
            'UPDATE posts SET view_count = view_count + 1 WHERE id = ?',
            [req.params.id]
        );

        // 사용자가 로그인한 경우 조회 기록 저장
        if (userId) {
            await db.query(
                `INSERT INTO post_views (user_id, post_id) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE viewed_at = CURRENT_TIMESTAMP`,
                [userId, req.params.id]
            );
        }

        // 게시글 조회
        const [posts] = await db.query(
            `SELECT p.*, 
                    u.name as author_name,
                    e.position as author_position,
                    e.department_id as author_department_id,
                    d.name as department_name,
                    b.name as board_name,
                    b.id as board_id
             FROM posts p
             JOIN users u ON p.user_id = u.id
             LEFT JOIN employees e ON u.id = e.user_id
             LEFT JOIN departments d ON e.department_id = d.id
             LEFT JOIN boards b ON p.board_id = b.id
             WHERE p.id = ? AND p.is_deleted = FALSE`,
            [req.params.id]
        );

        if (posts.length === 0) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // 첨부파일 조회
        const [attachments] = await db.query(
            'SELECT id, post_id, filename, original_filename, filepath, filesize, mimetype, created_at FROM attachments WHERE post_id = ?',
            [req.params.id]
        );

        // 댓글 조회
        const [comments] = await db.query(
            `SELECT c.*, 
                    u.name as author_name,
                    e.position as author_position
             FROM comments c
             JOIN users u ON c.user_id = u.id
             LEFT JOIN employees e ON u.id = e.user_id
             WHERE c.post_id = ? AND c.is_deleted = FALSE
             ORDER BY c.parent_id, c.created_at`,
            [req.params.id]
        );

        // 내가 좋아요 했는지 확인
        const [likes] = await db.query(
            'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        res.json({
            success: true,
            data: {
                post: posts[0],
                attachments,
                comments,
                isLiked: likes.length > 0
            }
        });
    } catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({
            success: false,
            message: '게시글 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 이전글/다음글 조회
// ============================================
router.get('/:id/adjacent', async (req, res) => {
    try {
        const postId = req.params.id;

        // 현재 게시글 정보 조회
        const [currentPost] = await db.query(
            'SELECT board_id, created_at FROM posts WHERE id = ? AND is_deleted = FALSE',
            [postId]
        );

        if (currentPost.length === 0) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const { board_id, created_at } = currentPost[0];

        // 이전글 조회 (더 오래된 글)
        const [prevPost] = await db.query(
            `SELECT p.id, p.title, p.created_at,
                    u.name as author_name
             FROM posts p
             JOIN users u ON p.user_id = u.id
             WHERE p.board_id = ? 
               AND p.created_at < ?
               AND p.is_deleted = FALSE
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [board_id, created_at]
        );

        // 다음글 조회 (더 최근 글)
        const [nextPost] = await db.query(
            `SELECT p.id, p.title, p.created_at,
                    u.name as author_name
             FROM posts p
             JOIN users u ON p.user_id = u.id
             WHERE p.board_id = ? 
               AND p.created_at > ?
               AND p.is_deleted = FALSE
             ORDER BY p.created_at ASC
             LIMIT 1`,
            [board_id, created_at]
        );

        res.json({
            success: true,
            data: {
                prev: prevPost[0] || null,
                next: nextPost[0] || null
            }
        });
    } catch (error) {
        console.error('Get adjacent posts error:', error);
        res.status(500).json({
            success: false,
            message: '이전/다음글 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 게시글 작성 (캐시 무효화)
// ============================================
router.post('/', invalidateCache(/^api:.*\/api\/v1\/posts/), async (req, res) => {
    try {
        const { board_id, category, title, content, is_notice, attachment_ids } = req.body;

        if (!board_id || !title || !content) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요.'
            });
        }

        // 공지 설정은 관리자만 가능
        const canSetNotice = ['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role);

        const [result] = await db.query(
            `INSERT INTO posts (board_id, user_id, category, title, content, is_notice)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [board_id, req.user.id, category || null, title, content, canSetNotice ? (is_notice || false) : false]
        );

        const postId = result.insertId;

        // 첨부파일 연결
        if (attachment_ids && Array.isArray(attachment_ids) && attachment_ids.length > 0) {
            for (const attachmentId of attachment_ids) {
                await db.query(
                    'UPDATE attachments SET post_id = ? WHERE id = ?',
                    [postId, attachmentId]
                );
            }
        }

        logActivity('info', `게시글 작성: "${title}" (게시판 ID: ${board_id}, 작성자: ${req.user.name})`, { userId: req.user.id, req });

        // 모든 게시글 등록 시 전체 사용자에게 알림 (작성자 제외)
        const [activeUsers] = await db.query(
            'SELECT id FROM users WHERE is_active = 1 AND id != ?', [req.user.id]
        );
        const userIds = activeUsers.map(u => u.id);
        if (userIds.length > 0) {
            const [boardRows] = await db.query('SELECT name FROM boards WHERE id = ?', [board_id]);
            const boardName = boardRows[0]?.name || '게시판';
            createNotification(userIds, {
                type: 'post',
                title: `[${boardName}] ${title}`,
                body: `${req.user.name}님이 새 글을 등록했습니다.`,
                url: `/boards/${board_id}/posts/${postId}`
            });
        }

        res.status(201).json({
            success: true,
            message: '게시글이 작성되었습니다.',
            data: { id: postId }
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({
            success: false,
            message: '게시글 작성 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 게시글 수정
// ============================================
router.put('/:id', invalidateCache(/^api:.*\/api\/v1\/posts/), async (req, res) => {
    try {
        const { category, title, content } = req.body;

        // 권한 확인 (본인 또는 관리자)
        const [posts] = await db.query(
            'SELECT user_id FROM posts WHERE id = ?',
            [req.params.id]
        );

        if (posts.length === 0) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const isOwner = posts[0].user_id === req.user.id;
        const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: '수정 권한이 없습니다.'
            });
        }

        await db.query(
            `UPDATE posts 
             SET category = ?, title = ?, content = ?
             WHERE id = ?`,
            [category || null, title, content, req.params.id]
        );

        res.json({
            success: true,
            message: '게시글이 수정되었습니다.'
        });
    } catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({
            success: false,
            message: '게시글 수정 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 게시글 삭제 (soft delete)
// ============================================
router.delete('/:id', invalidateCache(/^api:.*\/api\/v1\/posts/), async (req, res) => {
    try {
        // 권한 확인
        const [posts] = await db.query(
            'SELECT user_id FROM posts WHERE id = ?',
            [req.params.id]
        );

        if (posts.length === 0) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const isOwner = posts[0].user_id === req.user.id;
        const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: '삭제 권한이 없습니다.'
            });
        }

        await db.query(
            'UPDATE posts SET is_deleted = TRUE WHERE id = ?',
            [req.params.id]
        );

        logActivity('warning', `게시글 삭제: ID ${req.params.id} (삭제자: ${req.user.name})`, { userId: req.user.id, req });

        res.json({
            success: true,
            message: '게시글이 삭제되었습니다.'
        });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({
            success: false,
            message: '게시글 삭제 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 게시글 좋아요/취소
// ============================================
router.post('/:id/like', invalidateCache(/^api:.*\/api\/v1\/posts/), async (req, res) => {
    try {
        // 이미 좋아요 했는지 확인
        const [existing] = await db.query(
            'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (existing.length > 0) {
            // 좋아요 취소
            await db.query(
                'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
                [req.params.id, req.user.id]
            );

            await db.query(
                'UPDATE posts SET like_count = like_count - 1 WHERE id = ?',
                [req.params.id]
            );

            res.json({
                success: true,
                message: '좋아요가 취소되었습니다.',
                data: { isLiked: false }
            });
        } else {
            // 좋아요 추가
            await db.query(
                'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
                [req.params.id, req.user.id]
            );

            await db.query(
                'UPDATE posts SET like_count = like_count + 1 WHERE id = ?',
                [req.params.id]
            );

            res.json({
                success: true,
                message: '좋아요가 추가되었습니다.',
                data: { isLiked: true }
            });
        }
    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({
            success: false,
            message: '좋아요 처리 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
