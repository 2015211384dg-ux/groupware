const express = require('express');
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/auth');
const db = require('../config/database');

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// ============================================
// 부서 목록 조회 (조직도)
// ============================================
router.get('/', async (req, res) => {
    try {
        const [departments] = await db.query(
            `SELECT d.*,
                    COUNT(DISTINCT e.id) as employee_count
             FROM departments d
             LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'ACTIVE'
             WHERE d.is_active = TRUE
             GROUP BY d.id
             ORDER BY d.parent_id, d.order_no`
        );

        // 트리 구조로 변환
        const buildTree = (items, parentId = null) => {
            return items
                .filter(item => item.parent_id === parentId)
                .map(item => ({
                    ...item,
                    children: buildTree(items, item.id)
                }));
        };

        const tree = buildTree(departments);

        res.json({
            success: true,
            data: {
                departments,
                tree
            }
        });

    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({
            success: false,
            message: '부서 목록 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 부서 상세 조회
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const [departments] = await db.query(
            `SELECT d.*,
                    parent.name as parent_name,
                    COUNT(DISTINCT e.id) as employee_count
             FROM departments d
             LEFT JOIN departments parent ON d.parent_id = parent.id
             LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'ACTIVE'
             WHERE d.id = ?
             GROUP BY d.id`,
            [req.params.id]
        );

        if (departments.length === 0) {
            return res.status(404).json({
                success: false,
                message: '부서를 찾을 수 없습니다.'
            });
        }

        // 부서 소속 직원 조회
        const [employees] = await db.query(
            `SELECT u.id, u.name, e.employee_number, e.position, e.job_title,
                    e.mobile, e.extension, e.profile_image
             FROM employees e
             JOIN users u ON e.user_id = u.id
             WHERE e.department_id = ? AND e.status = 'ACTIVE'
             ORDER BY e.position DESC, u.name`,
            [req.params.id]
        );

        res.json({
            success: true,
            data: {
                department: departments[0],
                employees
            }
        });

    } catch (error) {
        console.error('Get department error:', error);
        res.status(500).json({
            success: false,
            message: '부서 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 부서 생성
// ============================================
router.post('/', checkRole('SUPER_ADMIN', 'HR_ADMIN'), async (req, res) => {
    try {
        const { name, parent_id, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: '부서명을 입력해주세요.'
            });
        }

        // depth 계산
        let depth = 0;
        if (parent_id) {
            const [parent] = await db.query(
                'SELECT depth FROM departments WHERE id = ?',
                [parent_id]
            );
            
            if (parent.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '상위 부서를 찾을 수 없습니다.'
                });
            }
            
            depth = parent[0].depth + 1;
        }

        // 부서 생성
        const [result] = await db.query(
            `INSERT INTO departments (name, parent_id, depth, description)
             VALUES (?, ?, ?, ?)`,
            [name, parent_id || null, depth, description || null]
        );

        res.status(201).json({
            success: true,
            message: '부서가 생성되었습니다.',
            data: { id: result.insertId }
        });

    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({
            success: false,
            message: '부서 생성 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 부서 수정
// ============================================
// ============================================
// 부서 순서 일괄 변경
// ============================================
router.put('/reorder', checkRole('SUPER_ADMIN', 'HR_ADMIN'), async (req, res) => {
    try {
        const { orders } = req.body; // [{ id, order_no }, ...]
        if (!Array.isArray(orders) || orders.length === 0) {
            return res.status(400).json({ success: false, message: '순서 데이터가 없습니다.' });
        }

        await Promise.all(
            orders.map(({ id, order_no }) =>
                db.query('UPDATE departments SET order_no = ? WHERE id = ?', [order_no, id])
            )
        );

        res.json({ success: true, message: '순서가 저장되었습니다.' });
    } catch (error) {
        console.error('Reorder departments error:', error);
        res.status(500).json({ success: false, message: '순서 저장 중 오류가 발생했습니다.' });
    }
});

router.put('/:id', checkRole('SUPER_ADMIN', 'HR_ADMIN'), async (req, res) => {
    try {
        const { name, parent_id, description, order_no, is_active } = req.body;

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (parent_id !== undefined) {
            updates.push('parent_id = ?');
            params.push(parent_id);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (order_no !== undefined) {
            updates.push('order_no = ?');
            params.push(order_no);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: '수정할 항목이 없습니다.'
            });
        }

        params.push(req.params.id);

        await db.query(
            `UPDATE departments SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        res.json({
            success: true,
            message: '부서가 수정되었습니다.'
        });

    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({
            success: false,
            message: '부서 수정 중 오류가 발생했습니다.'
        });
    }
});


router.delete('/:id', async (req, res) => {
    try {
        const deptId = req.params.id;

        // 하위 부서 확인
        const [children] = await db.query(
            'SELECT id FROM departments WHERE parent_id = ? AND is_active = TRUE',
            [deptId]
        );
        if (children.length > 0) {
            return res.status(400).json({
                success: false,
                message: '하위 부서가 있는 부서는 삭제할 수 없습니다. 먼저 하위 부서를 삭제해주세요.'
            });
        }

        // 소속 직원 확인
        const [employees] = await db.query(
            "SELECT id FROM employees WHERE department_id = ? AND status = 'ACTIVE'",
            [deptId]
        );
        if (employees.length > 0) {
            return res.status(400).json({
                success: false,
                message: `이 부서에 ${employees.length}명의 직원이 소속되어 있습니다. 직원을 먼저 다른 부서로 이동시켜주세요.`
            });
        }

        // 부서 존재 확인
        const [dept] = await db.query(
            'SELECT id FROM departments WHERE id = ? AND is_active = TRUE',
            [deptId]
        );
        if (dept.length === 0) {
            return res.status(404).json({ success: false, message: '부서를 찾을 수 없습니다.' });
        }

        // soft delete
        await db.query('UPDATE departments SET is_active = FALSE WHERE id = ?', [deptId]);

        res.json({ success: true, message: '부서가 삭제되었습니다.' });

    } catch (error) {
        console.error('Delete department error:', error);
        res.status(500).json({ success: false, message: '부서 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;