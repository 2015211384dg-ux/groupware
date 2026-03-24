const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');
const db = require('../config/database');

router.use(authMiddleware);

// ============================================
// 조직도 조회
// ============================================
router.get('/organization', cacheMiddleware(600), async (req, res) => {
    try {
        const [departments] = await db.query(`
            SELECT d.*, 
                   pd.name as parent_name,
                   (SELECT COUNT(*) FROM employees WHERE department_id = d.id) as employee_count
            FROM departments d
            LEFT JOIN departments pd ON d.parent_id = pd.id
            ORDER BY d.name
        `);

        const [employees] = await db.query(`
            SELECT e.*, 
                   u.username, u.email, u.name,
                   d.name as department_name
            FROM employees e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            ORDER BY d.name, e.position, u.name
        `);

        const buildTree = (parentId = null) => {
            return departments
                .filter(dept => dept.parent_id === parentId)
                .map(dept => ({ ...dept, children: buildTree(dept.id) }));
        };

        res.json({ success: true, data: { departments, tree: buildTree(null), employees } });
    } catch (error) {
        console.error('Organization error:', error);
        res.status(500).json({ success: false, message: '조직도 조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 전체 주소록 조회
// ============================================
router.get('/all', async (req, res) => {
    try {
        const { search, department_id } = req.query;

        let query = `
            SELECT e.*, u.username, u.email, u.name, d.name as department_name
            FROM employees e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (department_id) {
            query += ' AND e.department_id = ?';
            params.push(department_id);
        }
        if (search) {
            query += ' AND (u.name LIKE ? OR u.email LIKE ? OR e.position LIKE ? OR e.phone LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        query += ' ORDER BY d.name, e.position, u.name';

        const [employees] = await db.query(query, params);
        res.json({ success: true, data: employees });
    } catch (error) {
        console.error('Get all contacts error:', error);
        res.status(500).json({ success: false, message: '주소록 조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 부서별 직원 조회
// ============================================
router.get('/department/:id', async (req, res) => {
    try {
        const [employees] = await db.query(`
            SELECT e.*, u.username, u.email, u.name, d.name as department_name
            FROM employees e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.department_id = ?
            ORDER BY e.position, u.name
        `, [req.params.id]);

        res.json({ success: true, data: employees });
    } catch (error) {
        console.error('Get department employees error:', error);
        res.status(500).json({ success: false, message: '부서 직원 조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 직원 상세 정보 조회
// ============================================
router.get('/employee/:id', async (req, res) => {
    try {
        const [employees] = await db.query(`
            SELECT e.*, u.username, u.email, u.created_at as user_created_at, d.name as department_name
            FROM employees e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.id = ?
        `, [req.params.id]);

        if (employees.length === 0)
            return res.status(404).json({ success: false, message: '직원 정보를 찾을 수 없습니다.' });

        res.json({ success: true, data: employees[0] });
    } catch (error) {
        console.error('Get employee detail error:', error);
        res.status(500).json({ success: false, message: '직원 정보 조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 개인 주소록 조회
// ============================================
router.get('/personal', async (req, res) => {
    try {
        const [contacts] = await db.query(
            'SELECT id, user_id, name, company, department, position, phone, email, tags, memo, is_favorite, created_at, updated_at FROM personal_contacts WHERE user_id = ? ORDER BY name',
            [req.user.id]
        );
        res.json({ success: true, data: contacts });
    } catch (error) {
        console.error('Get personal contacts error:', error);
        res.status(500).json({ success: false, message: '개인 주소록 조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 개인 주소록 추가
// ============================================
router.post('/personal', [
    body('name').trim().notEmpty().withMessage('이름은 필수입니다.').isLength({ max: 100 }),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('올바른 이메일 형식이 아닙니다.'),
    body('phone').optional().isLength({ max: 20 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
        const { name, company, department, position, phone, email, tags, memo } = req.body;

        const [result] = await db.query(`
            INSERT INTO personal_contacts
                (user_id, name, company, department, position, phone, email, tags, memo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.user.id, name,
            company || null, department || null, position || null,
            phone || null, email || null, tags || null, memo || null
        ]);

        res.status(201).json({ success: true, message: '주소록이 추가되었습니다.', data: { id: result.insertId } });
    } catch (error) {
        console.error('Create personal contact error:', error);
        res.status(500).json({ success: false, message: '주소록 추가 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 개인 주소록 수정
// ============================================
router.put('/personal/:id', [
    body('name').trim().notEmpty().withMessage('이름은 필수입니다.').isLength({ max: 100 }),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('올바른 이메일 형식이 아닙니다.'),
    body('phone').optional().isLength({ max: 20 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
        const { name, company, department, position, phone, email, tags, memo } = req.body;

        const [contacts] = await db.query(
            'SELECT user_id FROM personal_contacts WHERE id = ?', [req.params.id]
        );
        if (contacts.length === 0)
            return res.status(404).json({ success: false, message: '주소록을 찾을 수 없습니다.' });
        if (contacts[0].user_id !== req.user.id)
            return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });

        await db.query(`
            UPDATE personal_contacts SET
                name = ?, company = ?, department = ?, position = ?,
                phone = ?, email = ?, tags = ?, memo = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [
            name,
            company || null, department || null, position || null,
            phone || null, email || null, tags || null, memo || null,
            req.params.id
        ]);

        res.json({ success: true, message: '주소록이 수정되었습니다.' });
    } catch (error) {
        console.error('Update personal contact error:', error);
        res.status(500).json({ success: false, message: '주소록 수정 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 개인 주소록 삭제
// ============================================
router.delete('/personal/:id', async (req, res) => {
    try {
        const [contacts] = await db.query(
            'SELECT user_id FROM personal_contacts WHERE id = ?', [req.params.id]
        );
        if (contacts.length === 0)
            return res.status(404).json({ success: false, message: '주소록을 찾을 수 없습니다.' });
        if (contacts[0].user_id !== req.user.id)
            return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });

        await db.query('DELETE FROM personal_contacts WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: '주소록이 삭제되었습니다.' });
    } catch (error) {
        console.error('Delete personal contact error:', error);
        res.status(500).json({ success: false, message: '주소록 삭제 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 개인 주소록 즐겨찾기 토글
// ============================================
router.put('/personal/:id/favorite', async (req, res) => {
    try {
        const [contacts] = await db.query(
            'SELECT user_id, is_favorite FROM personal_contacts WHERE id = ?', [req.params.id]
        );
        if (contacts.length === 0)
            return res.status(404).json({ success: false, message: '주소록을 찾을 수 없습니다.' });
        if (contacts[0].user_id !== req.user.id)
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });

        const newVal = contacts[0].is_favorite ? 0 : 1;
        await db.query('UPDATE personal_contacts SET is_favorite = ? WHERE id = ?', [newVal, req.params.id]);
        res.json({ success: true, is_favorite: !!newVal });
    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({ success: false, message: '즐겨찾기 처리 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 조직도 즐겨찾기 토글
// ============================================
router.post('/favorite/:id', async (req, res) => {
    try {
        const [existing] = await db.query(
            'SELECT id FROM favorite_contacts WHERE user_id = ? AND employee_id = ?',
            [req.user.id, req.params.id]
        );
        if (existing.length > 0) {
            await db.query(
                'DELETE FROM favorite_contacts WHERE user_id = ? AND employee_id = ?',
                [req.user.id, req.params.id]
            );
            res.json({ success: true, message: '즐겨찾기에서 제거되었습니다.', isFavorite: false });
        } else {
            await db.query(
                'INSERT INTO favorite_contacts (user_id, employee_id) VALUES (?, ?)',
                [req.user.id, req.params.id]
            );
            res.json({ success: true, message: '즐겨찾기에 추가되었습니다.', isFavorite: true });
        }
    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({ success: false, message: '즐겨찾기 처리 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 즐겨찾기 목록 조회
// ============================================
router.get('/favorites', async (req, res) => {
    try {
        const [favorites] = await db.query(`
            SELECT e.*, u.username, u.email, d.name as department_name, fc.created_at as favorited_at
            FROM favorite_contacts fc
            JOIN employees e ON fc.employee_id = e.id
            JOIN users u ON e.user_id = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE fc.user_id = ?
            ORDER BY fc.created_at DESC
        `, [req.user.id]);

        res.json({ success: true, data: favorites });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ success: false, message: '즐겨찾기 조회 중 오류가 발생했습니다.' });
    }
});

module.exports = router;