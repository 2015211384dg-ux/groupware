const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, checkRole } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

const ROLE_LABELS = {
    SUPER_ADMIN: '최고관리자',
    ADMIN: '관리자',
    HR_ADMIN: '인사관리자',
    USER: '일반사용자',
};

// ============================================
// 검토 목록 조회
// ============================================
router.get('/', authMiddleware, checkRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
    try {
        const [reviews] = await db.query(`
            SELECT ar.*, u.name AS reviewer_name,
                   COUNT(ari.id) AS total_items,
                   SUM(ari.action != 'pending') AS reviewed_items
            FROM access_reviews ar
            JOIN users u ON ar.reviewer_id = u.id
            LEFT JOIN access_review_items ari ON ar.id = ari.review_id
            GROUP BY ar.id
            ORDER BY ar.started_at DESC
        `);
        res.json({ success: true, data: reviews });
    } catch (error) {
        console.error('access_reviews GET error:', error);
        res.status(500).json({ success: false, message: '검토 목록을 불러오지 못했습니다.' });
    }
});

// ============================================
// 검토 상세 조회 (항목 포함)
// ============================================
router.get('/:id', authMiddleware, checkRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
    try {
        const [reviews] = await db.query(
            'SELECT ar.*, u.name AS reviewer_name FROM access_reviews ar JOIN users u ON ar.reviewer_id = u.id WHERE ar.id = ?',
            [req.params.id]
        );
        if (!reviews.length) return res.status(404).json({ success: false, message: '검토를 찾을 수 없습니다.' });

        const [items] = await db.query(`
            SELECT ari.*,
                   u.name AS user_name, u.username, u.is_active,
                   e.position, d.name AS dept_name,
                   rv.name AS reviewed_by_name
            FROM access_review_items ari
            JOIN users u ON ari.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN users rv ON ari.reviewer_id = rv.id
            WHERE ari.review_id = ?
            ORDER BY d.name, u.name
        `, [req.params.id]);

        res.json({ success: true, data: { ...reviews[0], items } });
    } catch (error) {
        console.error('access_review GET detail error:', error);
        res.status(500).json({ success: false, message: '검토 상세를 불러오지 못했습니다.' });
    }
});

// ============================================
// 새 검토 시작
// ============================================
router.post('/', authMiddleware, checkRole('SUPER_ADMIN'), async (req, res) => {
    try {
        // 진행 중인 검토 중복 방지
        const [ongoing] = await db.query(
            "SELECT id FROM access_reviews WHERE status = 'in_progress'"
        );
        if (ongoing.length) {
            return res.status(400).json({ success: false, message: '이미 진행 중인 검토가 있습니다. 완료 후 새 검토를 시작하세요.' });
        }

        const now = new Date();
        const year = now.getFullYear();
        const half = now.getMonth() < 6 ? 1 : 2;

        const [result] = await db.query(
            'INSERT INTO access_reviews (review_year, review_half, reviewer_id) VALUES (?, ?, ?)',
            [year, half, req.user.id]
        );
        const reviewId = result.insertId;

        // 활성 사용자 전원을 검토 항목으로 생성
        const [users] = await db.query(
            "SELECT id, role FROM users WHERE is_active = TRUE"
        );
        if (users.length) {
            const values = users.map(u => [reviewId, u.id, u.role, u.role]);
            await db.query(
                'INSERT INTO access_review_items (review_id, user_id, original_role, confirmed_role) VALUES ?',
                [values]
            );
        }

        logActivity('info', `접근권한 검토 시작: ${year}년 ${half === 1 ? '상' : '하'}반기`, { userId: req.user.id, req });

        res.status(201).json({
            success: true,
            message: '검토가 시작되었습니다.',
            data: { id: reviewId, review_year: year, review_half: half, total: users.length }
        });
    } catch (error) {
        console.error('access_review POST error:', error);
        res.status(500).json({ success: false, message: '검토 시작 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 항목 확인/수정
// ============================================
router.put('/:reviewId/items/:itemId', authMiddleware, checkRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const { reviewId, itemId } = req.params;
        const { action, confirmed_role, notes } = req.body;

        const validActions = ['confirmed', 'modified', 'deactivated'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ success: false, message: '유효하지 않은 action입니다.' });
        }

        // 검토가 진행 중인지 확인
        const [reviews] = await db.query(
            "SELECT id FROM access_reviews WHERE id = ? AND status = 'in_progress'",
            [reviewId]
        );
        if (!reviews.length) return res.status(400).json({ success: false, message: '진행 중인 검토가 아닙니다.' });

        const [items] = await db.query(
            'SELECT user_id, original_role FROM access_review_items WHERE id = ? AND review_id = ?',
            [itemId, reviewId]
        );
        if (!items.length) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });

        const finalRole = confirmed_role || items[0].original_role;

        await db.query(
            `UPDATE access_review_items
             SET action = ?, confirmed_role = ?, notes = ?, reviewed_at = NOW(), reviewer_id = ?
             WHERE id = ?`,
            [action, finalRole, notes || null, req.user.id, itemId]
        );

        // 역할 변경이면 실제 users 테이블 업데이트
        if (action === 'modified' && confirmed_role && confirmed_role !== items[0].original_role) {
            await db.query('UPDATE users SET role = ? WHERE id = ?', [confirmed_role, items[0].user_id]);
        }
        // 비활성화 처리
        if (action === 'deactivated') {
            await db.query('UPDATE users SET is_active = FALSE WHERE id = ?', [items[0].user_id]);
        }

        res.json({ success: true, message: '항목이 업데이트되었습니다.' });
    } catch (error) {
        console.error('access_review item PUT error:', error);
        res.status(500).json({ success: false, message: '항목 업데이트 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 검토 완료
// ============================================
router.post('/:id/complete', authMiddleware, checkRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const [reviews] = await db.query(
            "SELECT id FROM access_reviews WHERE id = ? AND status = 'in_progress'",
            [id]
        );
        if (!reviews.length) return res.status(400).json({ success: false, message: '진행 중인 검토가 아닙니다.' });

        // 미검토 항목 확인
        const [pending] = await db.query(
            "SELECT COUNT(*) AS cnt FROM access_review_items WHERE review_id = ? AND action = 'pending'",
            [id]
        );
        if (pending[0].cnt > 0) {
            return res.status(400).json({
                success: false,
                message: `아직 검토하지 않은 항목이 ${pending[0].cnt}개 있습니다.`
            });
        }

        await db.query(
            "UPDATE access_reviews SET status = 'completed', completed_at = NOW(), notes = ? WHERE id = ?",
            [notes || null, id]
        );

        logActivity('success', `접근권한 검토 완료 (review_id=${id})`, { userId: req.user.id, req });

        res.json({ success: true, message: '검토가 완료되었습니다.' });
    } catch (error) {
        console.error('access_review complete error:', error);
        res.status(500).json({ success: false, message: '검토 완료 처리 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
