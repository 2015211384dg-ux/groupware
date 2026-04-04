const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

router.use(authMiddleware);

const FINANCE_DEPT_ID = 4; // 재경팀
const isAdmin = (user) => ['SUPER_ADMIN', 'ADMIN'].includes(user.role);

// ── 활동 로그 기록 헬퍼 ───────────────────────
async function logActivity(projectId, userId, action, detail) {
    try {
        await db.query(
            'INSERT INTO ar_activity_logs (project_id, user_id, action, detail) VALUES (?, ?, ?, ?)',
            [projectId, userId, action, detail || null]
        );
    } catch (e) { console.error('ar log error:', e.message); }
}

// ── 부서 사용자들에게 AR 배정 알림 전송 ──────────
async function notifyDeptUsers(deptIds, message, url, excludeUserId) {
    if (!deptIds || deptIds.length === 0) return;
    try {
        const placeholders = deptIds.map(() => '?').join(',');
        const [users] = await db.query(
            `SELECT DISTINCT e.user_id
             FROM employees e
             WHERE e.department_id IN (${placeholders}) AND e.status = 'ACTIVE'`,
            deptIds
        );
        if (users.length === 0) return;
        const vals = users
            .filter(u => u.user_id !== excludeUserId)
            .map(u => [u.user_id, 'AR', message, url]);
        if (vals.length > 0) {
            await db.query(
                'INSERT INTO approval_notifications (user_id, type, message, url) VALUES ?',
                [vals]
            );
        }
    } catch (e) { console.error('ar notify error:', e.message); }
}

// ── 현재 사용자 department_id 조회 ────────────
async function getUserDeptId(userId) {
    const [[emp]] = await db.query(
        `SELECT department_id FROM employees WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1`,
        [userId]
    );
    return emp?.department_id || null;
}

// ── 프로젝트 접근 가능 여부 ─────────────────────
async function canAccessProject(userId, projectId, userRole) {
    if (isAdmin({ role: userRole })) return true;
    const deptId = await getUserDeptId(userId);
    if (deptId === FINANCE_DEPT_ID) return true;
    const [[project]] = await db.query('SELECT created_by FROM ar_projects WHERE id = ?', [projectId]);
    if (!project) return false;
    if (project.created_by === userId) return true;
    if (deptId) {
        const [[allowed]] = await db.query(
            'SELECT 1 FROM ar_project_teams WHERE project_id = ? AND department_id = ?',
            [projectId, deptId]
        );
        if (allowed) return true;
    }
    return false;
}

// ── 부서 목록 ─────────────────────────────────
router.get('/departments', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name FROM departments ORDER BY name');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 프로젝트 목록 (접근 가능한 것만) ─────────────
router.get('/projects', async (req, res) => {
    try {
        const userId   = req.user.id;
        const userRole = req.user.role;
        const deptId   = await getUserDeptId(userId);

        let whereClause = '';
        let params = [];
        if (!isAdmin({ role: userRole }) && deptId !== FINANCE_DEPT_ID) {
            whereClause = `WHERE (p.created_by = ? OR EXISTS (
                SELECT 1 FROM ar_project_teams pt WHERE pt.project_id = p.id AND pt.department_id = ?
            ))`;
            params = [userId, deptId || -1];
        }

        const [rows] = await db.query(`
            SELECT p.*, u.name AS creator_name,
                   COALESCE(SUM(e.amount), 0) AS spent_amount,
                   COUNT(DISTINCT e.id)        AS expense_count
            FROM ar_projects p
            JOIN users u ON u.id = p.created_by
            LEFT JOIN ar_expenses e ON e.project_id = p.id
            ${whereClause}
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `, params);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 프로젝트 생성 ─────────────────────────────
router.post('/projects', async (req, res) => {
    const { ar_code, title, description, budget_amount, currency = 'KRW', team_dept_ids = [] } = req.body;
    if (!ar_code || !title || !budget_amount) {
        return res.status(400).json({ success: false, message: 'AR 코드, 제목, 예산금액은 필수입니다.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO ar_projects (ar_code, title, description, budget_amount, currency, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ar_code, title, description || '', budget_amount, currency, req.user.id]
        );
        const projectId = result.insertId;
        if (team_dept_ids.length > 0) {
            const vals = team_dept_ids.map(dId => [projectId, dId]);
            await db.query('INSERT INTO ar_project_teams (project_id, department_id) VALUES ?', [vals]);
            await notifyDeptUsers(
                team_dept_ids,
                `우리 팀이 AR 프로젝트에 배정되었습니다: [${ar_code}] ${title}`,
                `/budget/ar`,
                req.user.id
            );
        }
        await logActivity(projectId, req.user.id, 'PROJECT_CREATED',
            `프로젝트 생성: [${ar_code}] ${title}, 예산 ${Number(budget_amount).toLocaleString()} ${currency}`);
        res.json({ success: true, data: { id: projectId } });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: `AR 코드 [${ar_code}]는 이미 사용 중입니다.` });
        }
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 프로젝트 상세 ─────────────────────────────
router.get('/projects/:id', async (req, res) => {
    try {
        const canAccess = await canAccessProject(req.user.id, req.params.id, req.user.role);
        if (!canAccess) return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });

        const [[project]] = await db.query(`
            SELECT p.*, u.name AS creator_name,
                   COALESCE(SUM(e.amount), 0) AS spent_amount
            FROM ar_projects p
            JOIN users u ON u.id = p.created_by
            LEFT JOIN ar_expenses e ON e.project_id = p.id
            WHERE p.id = ?
            GROUP BY p.id
        `, [req.params.id]);
        if (!project) return res.status(404).json({ success: false, message: '프로젝트 없음' });

        const [expenses] = await db.query(`
            SELECT e.*, u.name AS user_name, COALESCE(d.name, '') AS department_name
            FROM ar_expenses e
            JOIN users u ON u.id = e.user_id
            LEFT JOIN employees emp ON emp.user_id = e.user_id AND emp.status = 'ACTIVE'
            LEFT JOIN departments d ON d.id = emp.department_id
            WHERE e.project_id = ?
            ORDER BY e.spent_at DESC, e.created_at DESC
        `, [req.params.id]);

        const [monthly] = await db.query(`
            SELECT DATE_FORMAT(spent_at, '%Y-%m') AS month, SUM(amount) AS total
            FROM ar_expenses WHERE project_id = ?
            GROUP BY month ORDER BY month ASC
        `, [req.params.id]);

        const [byCategory] = await db.query(`
            SELECT COALESCE(category, '기타') AS category, SUM(amount) AS total
            FROM ar_expenses WHERE project_id = ?
            GROUP BY category ORDER BY total DESC
        `, [req.params.id]);

        const [teamDepts] = await db.query(`
            SELECT d.id, d.name FROM ar_project_teams pt
            JOIN departments d ON d.id = pt.department_id
            WHERE pt.project_id = ? ORDER BY d.name
        `, [req.params.id]);

        res.json({ success: true, data: { project, expenses, monthly, byCategory, teamDepts } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 활동 로그 조회 (관리자) ──────────────────
router.get('/projects/:id/logs', async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: '권한 없음' });
    try {
        const [logs] = await db.query(`
            SELECT l.*, u.name AS user_name, COALESCE(d.name,'') AS dept_name
            FROM ar_activity_logs l
            JOIN users u ON u.id = l.user_id
            LEFT JOIN employees emp ON emp.user_id = l.user_id AND emp.status = 'ACTIVE'
            LEFT JOIN departments d ON d.id = emp.department_id
            WHERE l.project_id = ?
            ORDER BY l.created_at DESC
        `, [req.params.id]);
        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 프로젝트 허용팀 재설정 ─────────────────────
router.put('/projects/:id/teams', async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: '권한 없음' });
    const { team_dept_ids = [] } = req.body;
    try {
        // 기존 배정 부서 조회 (신규 배정된 부서만 알림)
        const [prevTeams] = await db.query(
            'SELECT department_id FROM ar_project_teams WHERE project_id = ?', [req.params.id]
        );
        const prevDeptIds = prevTeams.map(r => r.department_id);
        const newDeptIds  = team_dept_ids.filter(id => !prevDeptIds.includes(id));

        await db.query('DELETE FROM ar_project_teams WHERE project_id = ?', [req.params.id]);
        if (team_dept_ids.length > 0) {
            const vals = team_dept_ids.map(dId => [req.params.id, dId]);
            await db.query('INSERT INTO ar_project_teams (project_id, department_id) VALUES ?', [vals]);
        }

        // 신규 배정된 부서에만 알림
        if (newDeptIds.length > 0) {
            const [[proj]] = await db.query('SELECT ar_code, title FROM ar_projects WHERE id=?', [req.params.id]);
            if (proj) {
                await notifyDeptUsers(
                    newDeptIds,
                    `우리 팀이 AR 프로젝트에 배정되었습니다: [${proj.ar_code}] ${proj.title}`,
                    `/budget/ar`,
                    req.user.id
                );
            }
        }

        await logActivity(req.params.id, req.user.id, 'TEAMS_UPDATED',
            `열람팀 변경: ${team_dept_ids.length}개 부서`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 프로젝트 수정 ─────────────────────────────
router.put('/projects/:id', async (req, res) => {
    const { title, description, budget_amount, currency, status } = req.body;
    try {
        const [[before]] = await db.query('SELECT * FROM ar_projects WHERE id=?', [req.params.id]);
        await db.query(
            `UPDATE ar_projects SET title=?, description=?, budget_amount=?, currency=?, status=?, updated_at=NOW()
             WHERE id=?`,
            [title, description, budget_amount, currency, status, req.params.id]
        );
        const changes = [];
        if (before.status !== status) changes.push(`상태: ${before.status} → ${status}`);
        if (Number(before.budget_amount) !== Number(budget_amount))
            changes.push(`예산: ${Number(before.budget_amount).toLocaleString()} → ${Number(budget_amount).toLocaleString()}`);
        if (before.title !== title) changes.push(`프로젝트명: "${before.title}" → "${title}"`);
        if (changes.length > 0)
            await logActivity(req.params.id, req.user.id, 'PROJECT_UPDATED', changes.join(' | '));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 프로젝트 삭제 ─────────────────────────────
router.delete('/projects/:id', async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: '권한 없음' });
    try {
        await db.query('DELETE FROM ar_projects WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 지출 추가 ────────────────────────────────
router.post('/projects/:id/expenses', async (req, res) => {
    const canAccess = await canAccessProject(req.user.id, req.params.id, req.user.role);
    if (!canAccess) return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
    const { amount, description, category, spent_at } = req.body;
    if (!amount || !description || !spent_at)
        return res.status(400).json({ success: false, message: '금액, 설명, 날짜는 필수입니다.' });

    // 잔여 예산 초과 체크
    const [[proj]] = await db.query(
        `SELECT budget_amount, COALESCE(SUM(e.amount),0) AS spent
         FROM ar_projects p LEFT JOIN ar_expenses e ON e.project_id = p.id
         WHERE p.id = ? GROUP BY p.id`, [req.params.id]
    );
    const remaining = Number(proj.budget_amount) - Number(proj.spent);
    if (Number(amount) > remaining) {
        return res.status(400).json({
            success: false,
            message: `잔여 예산(${Number(remaining).toLocaleString()})을 초과합니다. 등록하려면 관리자에게 문의하세요.`,
            remaining
        });
    }

    // 80% 임계 도달 여부 사전 계산
    const prevPct = Number(proj.budget_amount) > 0 ? Number(proj.spent) / Number(proj.budget_amount) : 0;
    const newPct  = Number(proj.budget_amount) > 0 ? (Number(proj.spent) + Number(amount)) / Number(proj.budget_amount) : 0;

    try {
        const [result] = await db.query(
            `INSERT INTO ar_expenses (project_id, user_id, amount, description, category, spent_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.params.id, req.user.id, amount, description, category || null, spent_at]
        );
        await logActivity(req.params.id, req.user.id, 'EXPENSE_ADDED',
            `지출 등록: ${category || '기타'} | ${description} | ${Number(amount).toLocaleString()} (${spent_at})`);

        // 80% 임계 알림 (이전 < 80%, 이후 >= 80%)
        if (prevPct < 0.8 && newPct >= 0.8) {
            const [[projInfo]] = await db.query(
                'SELECT created_by, ar_code, title FROM ar_projects WHERE id = ?', [req.params.id]
            );
            if (projInfo) {
                const usedPct = Math.round(newPct * 100);
                await db.query(
                    'INSERT INTO notifications (user_id, type, title, body, url) VALUES (?, ?, ?, ?, ?)',
                    [projInfo.created_by, 'ar',
                     `AR 예산 ${usedPct}% 도달: [${projInfo.ar_code}]`,
                     `"${projInfo.title}" 프로젝트 예산의 ${usedPct}%가 집행되었습니다. 잔여 예산을 확인하세요.`,
                     `/budget/ar`]
                );
            }
        }

        res.json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 지출 수정 (본인만) ─────────────────────────
router.put('/expenses/:id', async (req, res) => {
    const { amount, description, category, spent_at } = req.body;
    try {
        const [[exp]] = await db.query(
            'SELECT e.*, p.budget_amount, p.id AS project_id FROM ar_expenses e JOIN ar_projects p ON p.id = e.project_id WHERE e.id=?',
            [req.params.id]
        );
        if (!exp) return res.status(404).json({ success: false, message: '없음' });
        if (exp.user_id !== req.user.id && !isAdmin(req.user))
            return res.status(403).json({ success: false, message: '권한 없음' });

        // 잔여 예산 체크 (자기 지출 제외한 나머지 지출 합산)
        const [[{ spent }]] = await db.query(
            'SELECT COALESCE(SUM(amount),0) AS spent FROM ar_expenses WHERE project_id=? AND id!=?',
            [exp.project_id, req.params.id]
        );
        const remaining = Number(exp.budget_amount) - Number(spent);
        if (Number(amount) > remaining && !isAdmin(req.user)) {
            return res.status(400).json({ success: false, message: `잔여 예산(${Number(remaining).toLocaleString()})을 초과합니다.`, remaining });
        }

        await db.query(
            'UPDATE ar_expenses SET amount=?, description=?, category=?, spent_at=? WHERE id=?',
            [amount, description, category || null, spent_at, req.params.id]
        );
        await logActivity(exp.project_id, req.user.id, 'EXPENSE_UPDATED',
            `지출 수정: ${exp.description} → ${description} | ${Number(exp.amount).toLocaleString()} → ${Number(amount).toLocaleString()}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 지출 삭제 (관리자만) ──────────────────────
router.delete('/expenses/:id', async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: '관리자만 삭제할 수 있습니다.' });
    try {
        const [[exp]] = await db.query('SELECT * FROM ar_expenses WHERE id=?', [req.params.id]);
        if (!exp) return res.status(404).json({ success: false, message: '없음' });
        await db.query('DELETE FROM ar_expenses WHERE id=?', [req.params.id]);
        await logActivity(exp.project_id, req.user.id, 'EXPENSE_DELETED',
            `지출 삭제: ${exp.category || '기타'} | ${exp.description} | ${Number(exp.amount).toLocaleString()} (${exp.spent_at?.toISOString?.().slice(0,10) || exp.spent_at})`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ── 대시보드 통계 (월별 집계) ──────────────────
router.get('/stats', async (req, res) => {
    try {
        const userId   = req.user.id;
        const userRole = req.user.role;
        const deptId   = await getUserDeptId(userId);

        let projFilter = '';
        let params = [];
        if (!isAdmin({ role: userRole }) && deptId !== FINANCE_DEPT_ID) {
            projFilter = `AND (p.created_by = ? OR EXISTS (
                SELECT 1 FROM ar_project_teams pt WHERE pt.project_id = p.id AND pt.department_id = ?
            ))`;
            params = [userId, deptId || -1];
        }

        const [monthly] = await db.query(`
            SELECT DATE_FORMAT(e.spent_at, '%Y-%m') AS month, SUM(e.amount) AS total
            FROM ar_expenses e
            JOIN ar_projects p ON p.id = e.project_id
            WHERE 1=1 ${projFilter}
            GROUP BY month ORDER BY month ASC LIMIT 12
        `, params);

        res.json({ success: true, data: { monthly } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
