const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// ============================================
// 전체 게시판 통합 검색
// ============================================
router.get('/posts', async (req, res) => {
    try {
        const {
            keyword,           // 검색 키워드
            board_id,          // 게시판 ID (선택)
            category,          // 카테고리 (선택)
            author,            // 작성자명 (선택)
            start_date,        // 시작일 (선택)
            end_date,          // 종료일 (선택)
            page = 1,
            limit = 20
        } = req.query;

        console.log('🔍 검색 요청:', { keyword, board_id, category, author, start_date, end_date });

        const offset = (page - 1) * limit;

        let query = `
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

        const params = [];

        // 키워드 검색 (제목 + 내용)
        if (keyword) {
            query += ` AND (p.title LIKE ? OR p.content LIKE ?)`;
            params.push(`%${keyword}%`, `%${keyword}%`);
        }

        // 게시판 필터
        if (board_id) {
            query += ` AND p.board_id = ?`;
            params.push(board_id);
        }

        // 카테고리 필터
        if (category) {
            query += ` AND p.category = ?`;
            params.push(category);
        }

        // 작성자 필터
        if (author) {
            query += ` AND u.name LIKE ?`;
            params.push(`%${author}%`);
        }

        // 날짜 필터
        if (start_date) {
            query += ` AND DATE(p.created_at) >= ?`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(p.created_at) <= ?`;
            params.push(end_date);
        }

        // 전체 개수 조회
        const countQuery = query.replace(
            /SELECT p\.\*.*?FROM posts/s,
            'SELECT COUNT(*) as total FROM posts'
        );
        const [countResult] = await db.query(countQuery, params);
        const total = countResult[0].total;

        // 정렬 및 페이징
        query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const [posts] = await db.query(query, params);

        res.json({
            success: true,
            data: {
                posts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                },
                filters: {
                    keyword,
                    board_id,
                    category,
                    author,
                    start_date,
                    end_date
                }
            }
        });
    } catch (error) {
        console.error('Search posts error:', error);
        res.status(500).json({
            success: false,
            message: '검색 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 검색어 자동완성
// ============================================
router.get('/autocomplete', async (req, res) => {
    try {
        const { keyword, type = 'title' } = req.query;

        if (!keyword || keyword.length < 2) {
            return res.json({
                success: true,
                data: []
            });
        }

        let query;
        const params = [`%${keyword}%`];

        if (type === 'title') {
            // 제목 자동완성
            query = `
                SELECT DISTINCT title 
                FROM posts 
                WHERE title LIKE ? AND is_deleted = FALSE
                ORDER BY created_at DESC
                LIMIT 10
            `;
        } else if (type === 'author') {
            // 작성자 자동완성
            query = `
                SELECT DISTINCT u.name 
                FROM users u
                JOIN posts p ON u.id = p.user_id
                WHERE u.name LIKE ? AND p.is_deleted = FALSE
                LIMIT 10
            `;
        }

        const [results] = await db.query(query, params);

        res.json({
            success: true,
            data: results.map(r => r.title || r.name)
        });
    } catch (error) {
        console.error('Autocomplete error:', error);
        res.status(500).json({
            success: false,
            message: '자동완성 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 인기 검색어
// ============================================
router.get('/popular', async (req, res) => {
    try {
        // 최근 7일간 조회수가 높은 게시글의 키워드 추출
        const [posts] = await db.query(`
            SELECT title, view_count 
            FROM posts 
            WHERE is_deleted = FALSE 
              AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY view_count DESC 
            LIMIT 10
        `);

        res.json({
            success: true,
            data: posts.map(p => p.title)
        });
    } catch (error) {
        console.error('Popular search error:', error);
        res.status(500).json({
            success: false,
            message: '인기 검색어 조회 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
