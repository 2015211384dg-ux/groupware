const express = require('express');
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const db = require('../config/database');

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// ============================================
// 게시판 목록 조회
// ============================================
router.get('/', cacheMiddleware(600), async (req, res) => {
    try {
        const [boards] = await db.query(
            `SELECT b.*, 
                    COUNT(DISTINCT p.id) as post_count,
                    d.name as department_name
             FROM boards b
             LEFT JOIN posts p ON b.id = p.board_id AND p.is_deleted = FALSE
             LEFT JOIN departments d ON b.department_id = d.id
             WHERE b.is_active = TRUE
             GROUP BY b.id
             ORDER BY b.order_no, b.id`
        );

        res.json({
            success: true,
            data: boards
        });
    } catch (error) {
        console.error('Get boards error:', error);
        res.status(500).json({
            success: false,
            message: '게시판 목록 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 특정 게시판 상세 조회
// ============================================
router.get('/:boardId', cacheMiddleware(600), async (req, res) => {
    try {
        const [boards] = await db.query(
            `SELECT b.*, 
                    COUNT(DISTINCT p.id) as post_count,
                    d.name as department_name
             FROM boards b
             LEFT JOIN posts p ON b.id = p.board_id AND p.is_deleted = FALSE
             LEFT JOIN departments d ON b.department_id = d.id
             WHERE b.id = ? AND b.is_active = TRUE
             GROUP BY b.id`,
            [req.params.boardId]
        );

        if (boards.length === 0) {
            return res.status(404).json({
                success: false,
                message: '게시판을 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: boards[0]
        });
    } catch (error) {
        console.error('Get board error:', error);
        res.status(500).json({
            success: false,
            message: '게시판 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 게시판 생성 (관리자만)
// ============================================
router.post('/', checkRole('SUPER_ADMIN', 'HR_ADMIN'), invalidateCache(/^api:.*\/api\/v1\/boards/), async (req, res) => {
    try {
        const { name, description, board_type, department_id, is_public } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: '게시판 이름을 입력해주세요.'
            });
        }

        const [result] = await db.query(
            `INSERT INTO boards (name, description, board_type, department_id, is_public)
             VALUES (?, ?, ?, ?, ?)`,
            [name, description || null, board_type || 'FREE', department_id || null, is_public !== false]
        );

        res.status(201).json({
            success: true,
            message: '게시판이 생성되었습니다.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create board error:', error);
        res.status(500).json({
            success: false,
            message: '게시판 생성 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
