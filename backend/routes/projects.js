// ============================================================
// routes/projects.js  ─  프로젝트 관리 API
// ============================================================
const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const { logActivity } = require('../utils/logger');

router.use(authMiddleware);

// ─── 헬퍼 ────────────────────────────────────────────────────
function projectLog({ project_id, task_id = null, user_id, action, target = null, old_value = null, new_value = null, req = null }) {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null;
    db.query(
        `INSERT INTO project_activity_logs (project_id,task_id,user_id,action,target,old_value,new_value,ip_address)
         VALUES (?,?,?,?,?,?,?,?)`,
        [project_id, task_id, user_id, action, target,
         old_value ? JSON.stringify(old_value) : null,
         new_value ? JSON.stringify(new_value) : null, ip]
    ).catch(() => {});
}

async function pushNotif(user_id, { title, body, url }) {
    await db.query(
        `INSERT INTO notifications (user_id,type,title,body,url) VALUES (?,?,?,?,?)`,
        [user_id, 'project', title, body, url]
    ).catch(() => {});
}

// ─── 프로젝트 멤버 권한 미들웨어 ─────────────────────────────
const requireMember = async (req, res, next) => {
    try {
        const projectId = req.params.id;
        const [[member]] = await db.query(
            'SELECT role FROM project_members WHERE project_id=? AND user_id=?',
            [projectId, req.user.id]
        );
        if (!member) {
            const [[proj]] = await db.query('SELECT is_public FROM projects WHERE id=? AND status="active"', [projectId]);
            if (!proj) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });
            if (!proj.is_public) return res.status(403).json({ success: false, message: '프로젝트 접근 권한이 없습니다.' });
            req.projectRole = 'viewer';
        } else {
            req.projectRole = member.role;
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
};

const requireManager = (req, res, next) => {
    if (!['owner','manager'].includes(req.projectRole))
        return res.status(403).json({ success: false, message: '관리자 이상 권한이 필요합니다.' });
    next();
};

const canWrite = (req, res, next) => {
    if (req.projectRole === 'viewer')
        return res.status(403).json({ success: false, message: '쓰기 권한이 없습니다.' });
    next();
};

// ============================================================
// 프로젝트 CRUD
// ============================================================

// GET /projects  ─  내 프로젝트 목록
router.get('/', async (req, res) => {
    try {
        const [projects] = await db.query(`
            SELECT p.id, p.name, p.description, p.color, p.emoji, p.is_public,
                   p.home_tab, p.active_tabs, p.status, p.owner_id, p.created_at, p.updated_at,
                   pm.role AS my_role,
                   u.name  AS owner_name,
                   (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) AS member_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_total,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status='done') AS task_done
            FROM projects p
            INNER JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
            LEFT JOIN  users u ON p.owner_id = u.id
            WHERE p.status = 'active'
            ORDER BY p.updated_at DESC
        `, [req.user.id]);
        res.json({ success: true, projects });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/public  ─  회사 공개 프로젝트
router.get('/public', async (req, res) => {
    try {
        const [projects] = await db.query(`
            SELECT p.id, p.name, p.description, p.color, p.emoji,
                   p.require_approval,
                   u.name AS owner_name,
                   (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_total,
                   EXISTS(SELECT 1 FROM project_members pm2 WHERE pm2.project_id=p.id AND pm2.user_id=?) AS is_member,
                   (SELECT status FROM project_join_requests pjr WHERE pjr.project_id=p.id AND pjr.user_id=?) AS join_status
            FROM projects p
            LEFT JOIN users u ON p.owner_id = u.id
            WHERE p.is_public = 1 AND p.status = 'active'
            ORDER BY p.created_at DESC
        `, [req.user.id, req.user.id]);
        res.json({ success: true, projects });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/my-tasks  ─  내가 담당중인 업무 (허브용)
router.get('/my-tasks', async (req, res) => {
    try {
        const [tasks] = await db.query(`
            SELECT t.id, t.title, t.status, t.priority, t.due_date, t.progress,
                   p.id AS project_id, p.name AS project_name, p.color AS project_color, p.emoji AS project_emoji
            FROM tasks t
            INNER JOIN task_assignees ta ON t.id = ta.task_id AND ta.user_id = ?
            INNER JOIN projects p ON t.project_id = p.id AND p.status = 'active'
            WHERE t.status != 'done'
            ORDER BY t.due_date ASC, t.created_at DESC
            LIMIT 20
        `, [req.user.id]);
        res.json({ success: true, tasks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects  ─  프로젝트 생성
router.post('/', async (req, res) => {
    const { name, description, color, emoji, is_public, require_approval, home_tab, active_tabs } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: '프로젝트 이름을 입력해주세요.' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(`
            INSERT INTO projects (name,description,color,emoji,is_public,require_approval,home_tab,active_tabs,owner_id)
            VALUES (?,?,?,?,?,?,?,?,?)
        `, [name.trim(), description || null, color || '#667eea', emoji || null,
            is_public ? 1 : 0, require_approval ? 1 : 0,
            home_tab || 'task',
            JSON.stringify(active_tabs || ['feed','task','gantt','calendar','file']),
            req.user.id]);

        const pid = result.insertId;

        await conn.query(
            'INSERT INTO project_members (project_id,user_id,role) VALUES (?,?,?)',
            [pid, req.user.id, 'owner']
        );
        await conn.query(
            'INSERT INTO task_groups (project_id,name,sort_order) VALUES (?,?,?)',
            [pid, '기본 그룹', 0]
        );

        await conn.commit();
        conn.release();

        logActivity('info', `프로젝트 생성: ${name}`, { userId: req.user.id, req });

        const [[project]] = await db.query(
            'SELECT * FROM projects WHERE id=?', [pid]
        );
        res.status(201).json({ success: true, project });
    } catch (err) {
        await conn.rollback();
        conn.release();
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/:id
router.get('/:id', requireMember, async (req, res) => {
    try {
        const [[project]] = await db.query(`
            SELECT p.*, u.name AS owner_name,
                   (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id=p.id) AS member_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id) AS task_total,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status='done') AS task_done
            FROM projects p
            LEFT JOIN users u ON p.owner_id = u.id
            WHERE p.id=?
        `, [req.params.id]);
        if (!project) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });
        project.my_role = req.projectRole;
        res.json({ success: true, project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id
router.patch('/:id', requireMember, requireManager, async (req, res) => {
    const { name, description, color, emoji, is_public, home_tab } = req.body;
    try {
        await db.query(
            'UPDATE projects SET name=?,description=?,color=?,emoji=?,is_public=?,home_tab=? WHERE id=?',
            [name, description, color, emoji, is_public ? 1 : 0, home_tab, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id  ─  소유자만
router.delete('/:id', requireMember, async (req, res) => {
    if (req.projectRole !== 'owner')
        return res.status(403).json({ success: false, message: '소유자만 삭제할 수 있습니다.' });
    try {
        await db.query('DELETE FROM projects WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 멤버 관리
// ============================================================

// GET /projects/:id/members
router.get('/:id/members', requireMember, async (req, res) => {
    try {
        const [members] = await db.query(`
            SELECT pm.user_id, pm.role, pm.joined_at,
                   u.name, u.username, u.email, e.profile_image,
                   e.position, d.name AS department_name
            FROM project_members pm
            INNER JOIN users u ON pm.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE pm.project_id = ?
            ORDER BY FIELD(pm.role,'owner','manager','member','viewer'), u.name
        `, [req.params.id]);
        res.json({ success: true, members });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/members  ─  초대
router.post('/:id/members', requireMember, requireManager, async (req, res) => {
    const { user_id, role = 'member' } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다.' });
    try {
        await db.query(`
            INSERT INTO project_members (project_id,user_id,role,invited_by)
            VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE role=VALUES(role)
        `, [req.params.id, user_id, role, req.user.id]);

        const [[proj]] = await db.query('SELECT name FROM projects WHERE id=?', [req.params.id]);
        await pushNotif(user_id, {
            title: '프로젝트에 초대되었습니다.',
            body:  `${req.user.name}님이 [${proj.name}] 프로젝트에 초대했습니다.`,
            url:   `/project/${req.params.id}`
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/members/:uid/role
router.patch('/:id/members/:uid/role', requireMember, requireManager, async (req, res) => {
    const { role } = req.body;
    if (!['manager','member','viewer'].includes(role))
        return res.status(400).json({ success: false, message: '유효하지 않은 역할입니다.' });
    try {
        await db.query(
            'UPDATE project_members SET role=? WHERE project_id=? AND user_id=? AND role!="owner"',
            [role, req.params.id, req.params.uid]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/members/:uid
router.delete('/:id/members/:uid', requireMember, requireManager, async (req, res) => {
    const uid = parseInt(req.params.uid);
    if (uid === req.user.id && req.projectRole === 'owner')
        return res.status(400).json({ success: false, message: '소유자는 프로젝트에서 나갈 수 없습니다.' });
    try {
        await db.query(
            'DELETE FROM project_members WHERE project_id=? AND user_id=? AND role!="owner"',
            [req.params.id, uid]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/join  ─  공개 프로젝트 참여 (즉시 or 요청)
router.post('/:id/join', async (req, res) => {
    try {
        const [[proj]] = await db.query(
            'SELECT id, name, is_public, require_approval FROM projects WHERE id=? AND status="active"',
            [req.params.id]
        );
        if (!proj || !proj.is_public)
            return res.status(403).json({ success: false, message: '공개 프로젝트가 아닙니다.' });

        const [[already]] = await db.query(
            'SELECT 1 FROM project_members WHERE project_id=? AND user_id=?',
            [req.params.id, req.user.id]
        );
        if (already) return res.status(409).json({ success: false, message: '이미 멤버입니다.' });

        if (!proj.require_approval) {
            await db.query(
                'INSERT INTO project_members (project_id,user_id,role,invited_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE role=role',
                [req.params.id, req.user.id, 'member', req.user.id]
            );
            return res.json({ success: true, joined: true });
        }

        // 승인 필요 — 중복 요청 처리
        const [[existing]] = await db.query(
            'SELECT status FROM project_join_requests WHERE project_id=? AND user_id=?',
            [req.params.id, req.user.id]
        );
        if (existing) {
            if (existing.status === 'pending')
                return res.status(409).json({ success: false, message: '이미 요청이 접수되어 있습니다.' });
            if (existing.status === 'rejected')
                return res.status(403).json({ success: false, message: '이전 요청이 거절되었습니다. 관리자에게 직접 문의하세요.' });
        }

        await db.query(
            'INSERT INTO project_join_requests (project_id,user_id,message) VALUES (?,?,?) ON DUPLICATE KEY UPDATE status="pending", created_at=NOW()',
            [req.params.id, req.user.id, req.body.message || null]
        );

        // 프로젝트 소유자/관리자에게 알림
        const [managers] = await db.query(
            'SELECT user_id FROM project_members WHERE project_id=? AND role IN ("owner","manager")',
            [req.params.id]
        );
        for (const m of managers) {
            await pushNotif(m.user_id, {
                title: '프로젝트 참여 요청',
                body:  `${req.user.name}님이 [${proj.name}] 프로젝트 참여를 요청했습니다.`,
                url:   `/project/${req.params.id}`
            });
        }
        res.json({ success: true, joined: false, requested: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/:id/join-requests  ─  관리자용
router.get('/:id/join-requests', requireMember, requireManager, async (req, res) => {
    try {
        const [requests] = await db.query(`
            SELECT r.*, u.name, u.username,
                   e.position, d.name AS department_name
            FROM project_join_requests r
            INNER JOIN users u ON r.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE r.project_id=? AND r.status='pending'
            ORDER BY r.created_at ASC
        `, [req.params.id]);
        res.json({ success: true, requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/join-requests/:rid  ─  승인/거절
router.patch('/:id/join-requests/:rid', requireMember, requireManager, async (req, res) => {
    const { action } = req.body; // 'approve' | 'reject'
    if (!['approve','reject'].includes(action))
        return res.status(400).json({ success: false, message: 'action은 approve 또는 reject' });
    try {
        const [[r]] = await db.query(
            'SELECT * FROM project_join_requests WHERE id=? AND project_id=?',
            [req.params.rid, req.params.id]
        );
        if (!r) return res.status(404).json({ success: false, message: '요청 없음' });

        await db.query(
            'UPDATE project_join_requests SET status=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?',
            [action === 'approve' ? 'approved' : 'rejected', req.user.id, r.id]
        );

        const [[proj]] = await db.query('SELECT name FROM projects WHERE id=?', [req.params.id]);

        if (action === 'approve') {
            await db.query(
                'INSERT INTO project_members (project_id,user_id,role,invited_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE role=role',
                [req.params.id, r.user_id, 'member', req.user.id]
            );
            await pushNotif(r.user_id, {
                title: '프로젝트 참여 요청 승인',
                body:  `[${proj.name}] 프로젝트 참여가 승인되었습니다.`,
                url:   `/project/${req.params.id}`
            });
        } else {
            await pushNotif(r.user_id, {
                title: '프로젝트 참여 요청 거절',
                body:  `[${proj.name}] 프로젝트 참여 요청이 거절되었습니다.`,
                url:   `/project`
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/:id/members/search?q=  ─  초대용 사용자 검색
router.get('/:id/members/search', requireMember, requireManager, async (req, res) => {
    const q = req.query.q?.trim();
    if (!q || q.length < 1) return res.json({ success: true, users: [] });
    try {
        const [users] = await db.query(`
            SELECT u.id, u.name, u.username, u.email, e.profile_image,
                   e.position, d.name AS department_name,
                   EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=? AND pm.user_id=u.id) AS is_member
            FROM users u
            LEFT JOIN employees e ON u.id = e.user_id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE u.is_active=1 AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)
            LIMIT 10
        `, [req.params.id, `%${q}%`, `%${q}%`, `%${q}%`]);
        res.json({ success: true, users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 업무 그룹
// ============================================================

// GET /projects/:id/task-groups
router.get('/:id/task-groups', requireMember, async (req, res) => {
    try {
        const [groups] = await db.query(
            'SELECT * FROM task_groups WHERE project_id=? ORDER BY sort_order, id',
            [req.params.id]
        );
        res.json({ success: true, groups });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/task-groups
router.post('/:id/task-groups', requireMember, canWrite, async (req, res) => {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: '그룹 이름을 입력해주세요.' });
    try {
        const [[{ maxOrder }]] = await db.query(
            'SELECT COALESCE(MAX(sort_order),0) AS maxOrder FROM task_groups WHERE project_id=?',
            [req.params.id]
        );
        const [r] = await db.query(
            'INSERT INTO task_groups (project_id,name,color,sort_order) VALUES (?,?,?,?)',
            [req.params.id, name.trim(), color || '#667eea', maxOrder + 1]
        );
        const [[group]] = await db.query('SELECT * FROM task_groups WHERE id=?', [r.insertId]);
        res.status(201).json({ success: true, group });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/task-groups/:gid
router.patch('/:id/task-groups/:gid', requireMember, canWrite, async (req, res) => {
    const { name, color } = req.body;
    try {
        await db.query(
            'UPDATE task_groups SET name=?,color=? WHERE id=? AND project_id=?',
            [name, color, req.params.gid, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/task-groups/:gid
router.delete('/:id/task-groups/:gid', requireMember, requireManager, async (req, res) => {
    try {
        // 그룹 내 업무들을 미지정 상태로 변경
        await db.query('UPDATE tasks SET group_id=NULL WHERE group_id=? AND project_id=?', [req.params.gid, req.params.id]);
        await db.query('DELETE FROM task_groups WHERE id=? AND project_id=?', [req.params.gid, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 업무 (Tasks)
// ============================================================

// GET /projects/:id/tasks
router.get('/:id/tasks', requireMember, async (req, res) => {
    try {
        const { status, group_id, assignee } = req.query;
        let where = 'WHERE t.project_id=?';
        const params = [req.params.id];

        if (status)    { where += ' AND t.status=?';   params.push(status); }
        if (group_id)  { where += ' AND t.group_id=?'; params.push(group_id); }
        if (assignee)  { where += ' AND EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id=t.id AND ta.user_id=?)'; params.push(assignee); }

        const [tasks] = await db.query(`
            SELECT t.*,
                   u.name AS creator_name,
                   tg.name AS group_name, tg.color AS group_color
            FROM tasks t
            LEFT JOIN users u  ON t.created_by = u.id
            LEFT JOIN task_groups tg ON t.group_id = tg.id
            ${where}
            ORDER BY t.group_id, t.sort_order, t.created_at
        `, params);

        if (!tasks.length) return res.json({ success: true, tasks: [] });

        // 담당자 일괄 조회
        const taskIds = tasks.map(t => t.id);
        const [assignees] = await db.query(`
            SELECT ta.task_id, u.id AS user_id, u.name, e.profile_image
            FROM task_assignees ta
            INNER JOIN users u ON ta.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE ta.task_id IN (?)
        `, [taskIds]);

        const assigneeMap = {};
        assignees.forEach(a => {
            if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
            assigneeMap[a.task_id].push({ user_id: a.user_id, name: a.name, profile_image: a.profile_image });
        });

        tasks.forEach(t => { t.assignees = assigneeMap[t.id] || []; });

        // 커스텀 값 일괄 조회 (테이블 없을 경우 무시)
        try {
            const [customVals] = await db.query(
                'SELECT task_id, column_id, value FROM task_custom_values WHERE task_id IN (?)',
                [taskIds]
            );
            const customMap = {};
            customVals.forEach(v => {
                if (!customMap[v.task_id]) customMap[v.task_id] = {};
                customMap[v.task_id][v.column_id] = v.value;
            });
            tasks.forEach(t => { t.custom_values = customMap[t.id] || {}; });
        } catch {
            tasks.forEach(t => { t.custom_values = {}; });
        }

        res.json({ success: true, tasks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/tasks
router.post('/:id/tasks', requireMember, canWrite, async (req, res) => {
    const { title, description, group_id, priority, start_date, due_date } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: '업무 제목을 입력해주세요.' });
    try {
        const [[{ maxOrder }]] = await db.query(
            'SELECT COALESCE(MAX(sort_order),0) AS maxOrder FROM tasks WHERE project_id=? AND group_id<=>?',
            [req.params.id, group_id || null]
        );
        const [r] = await db.query(`
            INSERT INTO tasks (project_id,group_id,title,description,priority,start_date,due_date,sort_order,created_by)
            VALUES (?,?,?,?,?,?,?,?,?)
        `, [req.params.id, group_id || null, title.trim(), description || null,
            priority || 'normal', start_date || null, due_date || null,
            maxOrder + 1, req.user.id]);

        const [[task]] = await db.query(`
            SELECT t.*, tg.name AS group_name, tg.color AS group_color
            FROM tasks t
            LEFT JOIN task_groups tg ON t.group_id = tg.id
            WHERE t.id=?
        `, [r.insertId]);
        task.assignees = [];

        projectLog({ project_id: req.params.id, task_id: r.insertId, user_id: req.user.id, action: 'task_created', target: 'task', new_value: { title }, req });
        res.status(201).json({ success: true, task });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/:id/tasks/:tid
router.get('/:id/tasks/:tid', requireMember, async (req, res) => {
    try {
        const [[task]] = await db.query(`
            SELECT t.*, u.name AS creator_name,
                   tg.name AS group_name, tg.color AS group_color
            FROM tasks t
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN task_groups tg ON t.group_id = tg.id
            WHERE t.id=? AND t.project_id=?
        `, [req.params.tid, req.params.id]);
        if (!task) return res.status(404).json({ success: false, message: '업무를 찾을 수 없습니다.' });

        const [assignees] = await db.query(`
            SELECT u.id AS user_id, u.name, e.profile_image, e.position
            FROM task_assignees ta
            INNER JOIN users u ON ta.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE ta.task_id=?
        `, [task.id]);
        task.assignees = assignees;

        const [comments] = await db.query(`
            SELECT c.*, u.name AS user_name, e.profile_image
            FROM task_comments c
            INNER JOIN users u ON c.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE c.task_id=? AND c.is_deleted=0
            ORDER BY c.created_at ASC
        `, [task.id]);
        task.comments = comments;

        res.json({ success: true, task });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/tasks/:tid
router.patch('/:id/tasks/:tid', requireMember, canWrite, async (req, res) => {
    const { title, description, group_id, priority, start_date, due_date, progress } = req.body;
    try {
        const [[prev]] = await db.query('SELECT * FROM tasks WHERE id=? AND project_id=?', [req.params.tid, req.params.id]);
        if (!prev) return res.status(404).json({ success: false, message: '업무를 찾을 수 없습니다.' });

        await db.query(`
            UPDATE tasks SET
                title=COALESCE(?,title),
                description=COALESCE(?,description),
                group_id=?,
                priority=COALESCE(?,priority),
                start_date=?,
                due_date=?,
                progress=COALESCE(?,progress)
            WHERE id=? AND project_id=?
        `, [title, description, group_id !== undefined ? (group_id || null) : prev.group_id,
            priority, start_date || null, due_date || null, progress,
            req.params.tid, req.params.id]);

        projectLog({ project_id: req.params.id, task_id: parseInt(req.params.tid), user_id: req.user.id, action: 'task_updated', target: 'task', old_value: prev, new_value: req.body, req });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/tasks/:tid/status
router.patch('/:id/tasks/:tid/status', requireMember, canWrite, async (req, res) => {
    const { status } = req.body;
    if (!['todo','in_progress','done','on_hold'].includes(status))
        return res.status(400).json({ success: false, message: '유효하지 않은 상태입니다.' });
    try {
        const [[prev]] = await db.query('SELECT status FROM tasks WHERE id=? AND project_id=?', [req.params.tid, req.params.id]);
        if (!prev) return res.status(404).json({ success: false, message: '업무를 찾을 수 없습니다.' });

        await db.query(
            'UPDATE tasks SET status=?, completed_at=? WHERE id=? AND project_id=?',
            [status, status === 'done' ? new Date() : null, req.params.tid, req.params.id]
        );

        // 완료 시 담당자들에게 알림
        if (status === 'done') {
            const [[t]] = await db.query('SELECT title FROM tasks WHERE id=?', [req.params.tid]);
            const [assignees] = await db.query('SELECT user_id FROM task_assignees WHERE task_id=?', [req.params.tid]);
            for (const a of assignees) {
                if (a.user_id !== req.user.id) {
                    await pushNotif(a.user_id, {
                        title: '업무가 완료되었습니다.',
                        body:  `[${t.title}] 업무가 완료 처리되었습니다.`,
                        url:   `/project/${req.params.id}`
                    });
                }
            }
        }

        projectLog({ project_id: req.params.id, task_id: parseInt(req.params.tid), user_id: req.user.id, action: 'status_changed', target: 'task', old_value: { status: prev.status }, new_value: { status }, req });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/tasks/:tid
router.delete('/:id/tasks/:tid', requireMember, canWrite, async (req, res) => {
    try {
        const [[task]] = await db.query('SELECT created_by FROM tasks WHERE id=? AND project_id=?', [req.params.tid, req.params.id]);
        if (!task) return res.status(404).json({ success: false, message: '업무를 찾을 수 없습니다.' });

        const isManager = ['owner','manager'].includes(req.projectRole);
        if (!isManager && task.created_by !== req.user.id)
            return res.status(403).json({ success: false, message: '본인이 생성한 업무만 삭제할 수 있습니다.' });

        await db.query('DELETE FROM tasks WHERE id=?', [req.params.tid]);
        projectLog({ project_id: req.params.id, task_id: parseInt(req.params.tid), user_id: req.user.id, action: 'task_deleted', target: 'task', req });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 담당자
// ============================================================

// POST /projects/:id/tasks/:tid/assignees
router.post('/:id/tasks/:tid/assignees', requireMember, canWrite, async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다.' });
    try {
        // 프로젝트 멤버인지 확인
        const [[member]] = await db.query(
            'SELECT 1 FROM project_members WHERE project_id=? AND user_id=?',
            [req.params.id, user_id]
        );
        if (!member) return res.status(400).json({ success: false, message: '프로젝트 멤버만 담당자로 지정할 수 있습니다.' });

        await db.query(
            'INSERT IGNORE INTO task_assignees (task_id,user_id,assigned_by) VALUES (?,?,?)',
            [req.params.tid, user_id, req.user.id]
        );

        const [[t]] = await db.query('SELECT title, project_id FROM tasks WHERE id=?', [req.params.tid]);
        if (user_id !== req.user.id) {
            await pushNotif(user_id, {
                title: '업무 담당자로 지정되었습니다.',
                body:  `[${t.title}] 업무의 담당자로 지정되었습니다.`,
                url:   `/project/${req.params.id}`
            });
        }

        const [[u]] = await db.query('SELECT id AS user_id, name, profile_image FROM users WHERE id=?', [user_id]);
        projectLog({ project_id: req.params.id, task_id: parseInt(req.params.tid), user_id: req.user.id, action: 'assignee_added', target: 'task', new_value: { user_id }, req });
        res.json({ success: true, assignee: u });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/tasks/:tid/assignees/:uid
router.delete('/:id/tasks/:tid/assignees/:uid', requireMember, canWrite, async (req, res) => {
    try {
        await db.query('DELETE FROM task_assignees WHERE task_id=? AND user_id=?', [req.params.tid, req.params.uid]);
        projectLog({ project_id: req.params.id, task_id: parseInt(req.params.tid), user_id: req.user.id, action: 'assignee_removed', target: 'task', old_value: { user_id: req.params.uid }, req });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 댓글
// ============================================================

// GET /projects/:id/tasks/:tid/comments
router.get('/:id/tasks/:tid/comments', requireMember, async (req, res) => {
    try {
        const [comments] = await db.query(`
            SELECT c.id, c.content, c.created_at, c.updated_at,
                   u.id AS user_id, u.name AS user_name, e.profile_image
            FROM task_comments c
            INNER JOIN users u ON c.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE c.task_id=? AND c.is_deleted=0
            ORDER BY c.created_at ASC
        `, [req.params.tid]);
        res.json({ success: true, comments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/tasks/:tid/comments
router.post('/:id/tasks/:tid/comments', requireMember, canWrite, async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: '댓글 내용을 입력해주세요.' });
    try {
        const [r] = await db.query(
            'INSERT INTO task_comments (task_id,user_id,content) VALUES (?,?,?)',
            [req.params.tid, req.user.id, content.trim()]
        );
        const [[comment]] = await db.query(`
            SELECT c.id, c.content, c.created_at,
                   u.id AS user_id, u.name AS user_name, e.profile_image
            FROM task_comments c
            INNER JOIN users u ON c.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE c.id=?
        `, [r.insertId]);

        // 담당자 및 업무 생성자에게 알림
        const [[t]] = await db.query('SELECT title, created_by FROM tasks WHERE id=?', [req.params.tid]);
        const [assignees] = await db.query('SELECT user_id FROM task_assignees WHERE task_id=?', [req.params.tid]);
        const notifySet = new Set([...assignees.map(a => a.user_id), t.created_by]);
        notifySet.delete(req.user.id);

        for (const uid of notifySet) {
            await pushNotif(uid, {
                title: '업무에 댓글이 달렸습니다.',
                body:  `${req.user.name}: ${content.substring(0, 50)}`,
                url:   `/project/${req.params.id}`
            });
        }

        res.status(201).json({ success: true, comment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/tasks/:tid/comments/:cid
router.delete('/:id/tasks/:tid/comments/:cid', requireMember, canWrite, async (req, res) => {
    try {
        const [[c]] = await db.query('SELECT user_id FROM task_comments WHERE id=?', [req.params.cid]);
        if (!c) return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });
        const isManager = ['owner','manager'].includes(req.projectRole);
        if (!isManager && c.user_id !== req.user.id)
            return res.status(403).json({ success: false, message: '본인 댓글만 삭제할 수 있습니다.' });
        await db.query('UPDATE task_comments SET is_deleted=1 WHERE id=?', [req.params.cid]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 피드 (Feed)
// ============================================================

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const feedUploadDir = path.join(__dirname, '../uploads/project-feed');
if (!fs.existsSync(feedUploadDir)) fs.mkdirSync(feedUploadDir, { recursive: true });

const projectFileUploadDir = path.join(__dirname, '../uploads/project-files');
if (!fs.existsSync(projectFileUploadDir)) fs.mkdirSync(projectFileUploadDir, { recursive: true });

const projectFileUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, projectFileUploadDir),
        filename: (req, file, cb) => {
            const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const ext  = path.extname(original);
            const base = path.basename(original, ext);
            cb(null, `${base}-${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
});

const feedUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, feedUploadDir),
        filename: (req, file, cb) => {
            const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const ext  = path.extname(original);
            const base = path.basename(original, ext);
            cb(null, `${base}-${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg','.jpeg','.png','.gif','.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.zip','.txt','.hwp','.mp4','.mov'];
        const ext = path.extname(Buffer.from(file.originalname,'latin1').toString('utf8')).toLowerCase();
        allowed.includes(ext) ? cb(null, true) : cb(new Error('허용되지 않는 파일 형식'));
    }
});

// GET /projects/:id/feed
router.get('/:id/feed', requireMember, async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 20;
        const offset = (page - 1) * limit;

        const [feeds] = await db.query(`
            SELECT f.id, f.post_type, f.title, f.content, f.post_meta,
                   f.is_pinned, f.created_at, f.updated_at,
                   u.id AS user_id, u.name AS user_name, e.profile_image, e.position,
                   (SELECT COUNT(*) FROM feed_comments fc WHERE fc.feed_id=f.id AND fc.is_deleted=0) AS comment_count
            FROM project_feeds f
            INNER JOIN users u ON f.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE f.project_id=? AND f.is_deleted=0
            ORDER BY f.is_pinned DESC, f.created_at DESC
            LIMIT ? OFFSET ?
        `, [req.params.id, limit, offset]);

        if (!feeds.length) return res.json({ success: true, feeds: [], has_more: false });

        const feedIds = feeds.map(f => f.id);

        // 첨부파일
        const [attachments] = await db.query('SELECT * FROM feed_attachments WHERE feed_id IN (?)', [feedIds]);
        const attachMap = {};
        attachments.forEach(a => { if (!attachMap[a.feed_id]) attachMap[a.feed_id] = []; attachMap[a.feed_id].push(a); });

        // 할 일 항목
        const [todoItems] = await db.query(
            'SELECT * FROM feed_todo_items WHERE feed_id IN (?) ORDER BY sort_order, id',
            [feedIds]
        );
        const todoMap = {};
        todoItems.forEach(t => { if (!todoMap[t.feed_id]) todoMap[t.feed_id] = []; todoMap[t.feed_id].push(t); });

        // 투표 항목 + 득표수
        const [pollOpts] = await db.query(`
            SELECT o.*, COUNT(v.id) AS vote_count,
                   MAX(CASE WHEN v.user_id=? THEN 1 ELSE 0 END) AS my_vote
            FROM feed_poll_options o
            LEFT JOIN feed_poll_votes v ON o.id=v.option_id
            WHERE o.feed_id IN (?)
            GROUP BY o.id ORDER BY o.sort_order, o.id
        `, [req.user.id, feedIds]);
        const pollMap = {};
        pollOpts.forEach(o => { if (!pollMap[o.feed_id]) pollMap[o.feed_id] = []; pollMap[o.feed_id].push(o); });

        feeds.forEach(f => {
            f.attachments = attachMap[f.id] || [];
            f.todo_items  = todoMap[f.id]  || [];
            f.poll_options = pollMap[f.id] || [];
            if (f.post_meta && typeof f.post_meta === 'string') {
                try { f.post_meta = JSON.parse(f.post_meta); } catch {}
            }
        });

        const [[{ total }]] = await db.query(
            'SELECT COUNT(*) AS total FROM project_feeds WHERE project_id=? AND is_deleted=0',
            [req.params.id]
        );
        res.json({ success: true, feeds, has_more: offset + feeds.length < total, total });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/feed
router.post('/:id/feed', requireMember, canWrite, feedUpload.array('files', 5), async (req, res) => {
    const { content, title, post_type = 'text', post_meta, todo_items, poll_options } = req.body;

    // 유효성 검사: 타입별
    const type = post_type || 'text';
    if (type === 'text' && !content?.trim() && !req.files?.length)
        return res.status(400).json({ success: false, message: '내용을 입력하거나 파일을 첨부해주세요.' });
    if (type === 'todo' && !title?.trim())
        return res.status(400).json({ success: false, message: '제목을 입력해주세요.' });
    if (type === 'schedule' && !title?.trim())
        return res.status(400).json({ success: false, message: '제목을 입력해주세요.' });
    if (type === 'poll' && !title?.trim())
        return res.status(400).json({ success: false, message: '제목을 입력해주세요.' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const metaVal = post_meta ? (typeof post_meta === 'string' ? post_meta : JSON.stringify(post_meta)) : null;

        const [r] = await conn.query(
            'INSERT INTO project_feeds (project_id,user_id,post_type,title,content,post_meta) VALUES (?,?,?,?,?,?)',
            [req.params.id, req.user.id, type, (title || '').trim() || null, (content || '').trim() || '', metaVal]
        );
        const feedId = r.insertId;

        // 파일 첨부
        if (req.files?.length) {
            for (const file of req.files) {
                const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                await conn.query(
                    'INSERT INTO feed_attachments (feed_id,file_name,file_path,file_size,mime_type) VALUES (?,?,?,?,?)',
                    [feedId, originalName, file.path, file.size, file.mimetype]
                );
            }
        }

        // 할 일 항목
        if (type === 'todo' && todo_items) {
            const items = typeof todo_items === 'string' ? JSON.parse(todo_items) : todo_items;
            for (let i = 0; i < items.length; i++) {
                if (items[i]?.trim()) {
                    await conn.query(
                        'INSERT INTO feed_todo_items (feed_id,item_text,sort_order) VALUES (?,?,?)',
                        [feedId, items[i].trim(), i]
                    );
                }
            }
        }

        // 투표 항목
        if (type === 'poll' && poll_options) {
            const opts = typeof poll_options === 'string' ? JSON.parse(poll_options) : poll_options;
            for (let i = 0; i < opts.length; i++) {
                if (opts[i]?.trim()) {
                    await conn.query(
                        'INSERT INTO feed_poll_options (feed_id,option_text,sort_order) VALUES (?,?,?)',
                        [feedId, opts[i].trim(), i]
                    );
                }
            }
        }

        await conn.commit();
        conn.release();

        // 멤버 알림
        const [members] = await db.query(
            'SELECT user_id FROM project_members WHERE project_id=? AND user_id!=? LIMIT 50',
            [req.params.id, req.user.id]
        );
        const [[proj]] = await db.query('SELECT name FROM projects WHERE id=?', [req.params.id]);
        const typeLabel = { text:'글', todo:'할 일', schedule:'일정', poll:'투표' }[type] || '게시글';
        for (const m of members) {
            await pushNotif(m.user_id, {
                title: `[${proj.name}] 새 ${typeLabel}이 등록되었습니다.`,
                body:  `${req.user.name}: ${(title || content || '').substring(0, 60)}`,
                url:   `/project/${req.params.id}?tab=feed`
            });
        }

        // 조회 후 반환
        const [[feed]] = await db.query(`
            SELECT f.id, f.post_type, f.title, f.content, f.post_meta,
                   f.is_pinned, f.created_at,
                   u.id AS user_id, u.name AS user_name, e.profile_image, e.position,
                   0 AS comment_count
            FROM project_feeds f
            INNER JOIN users u ON f.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE f.id=?
        `, [feedId]);

        if (feed.post_meta && typeof feed.post_meta === 'string') {
            try { feed.post_meta = JSON.parse(feed.post_meta); } catch {}
        }

        const [attachments] = await db.query('SELECT * FROM feed_attachments WHERE feed_id=?', [feedId]);
        feed.attachments = attachments;

        const [todoRows] = await db.query('SELECT * FROM feed_todo_items WHERE feed_id=? ORDER BY sort_order', [feedId]);
        feed.todo_items = todoRows;

        const [pollRows] = await db.query(
            'SELECT o.*, 0 AS vote_count, 0 AS my_vote FROM feed_poll_options o WHERE o.feed_id=? ORDER BY o.sort_order',
            [feedId]
        );
        feed.poll_options = pollRows;

        projectLog({ project_id: req.params.id, user_id: req.user.id, action: 'feed_posted', target: type, req });
        res.status(201).json({ success: true, feed });
    } catch (err) {
        await conn.rollback();
        conn.release();
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/feed/:fid — 수정 (본인 또는 관리자)
router.patch('/:id/feed/:fid', requireMember, canWrite, async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: '내용을 입력해주세요.' });
    try {
        const [[feed]] = await db.query('SELECT user_id FROM project_feeds WHERE id=? AND project_id=?', [req.params.fid, req.params.id]);
        if (!feed) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        const isManager = ['owner','manager'].includes(req.projectRole);
        if (!isManager && feed.user_id !== req.user.id)
            return res.status(403).json({ success: false, message: '본인 게시글만 수정할 수 있습니다.' });

        await db.query('UPDATE project_feeds SET content=? WHERE id=?', [content.trim(), req.params.fid]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/feed/:fid
router.delete('/:id/feed/:fid', requireMember, canWrite, async (req, res) => {
    try {
        const [[feed]] = await db.query('SELECT user_id FROM project_feeds WHERE id=? AND project_id=?', [req.params.fid, req.params.id]);
        if (!feed) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        const isManager = ['owner','manager'].includes(req.projectRole);
        if (!isManager && feed.user_id !== req.user.id)
            return res.status(403).json({ success: false, message: '본인 게시글만 삭제할 수 있습니다.' });

        await db.query('UPDATE project_feeds SET is_deleted=1 WHERE id=?', [req.params.fid]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/feed/:fid/pin — 핀 고정 (관리자)
router.patch('/:id/feed/:fid/pin', requireMember, requireManager, async (req, res) => {
    try {
        const [[feed]] = await db.query('SELECT is_pinned FROM project_feeds WHERE id=? AND project_id=?', [req.params.fid, req.params.id]);
        if (!feed) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        await db.query('UPDATE project_feeds SET is_pinned=? WHERE id=?', [feed.is_pinned ? 0 : 1, req.params.fid]);
        res.json({ success: true, is_pinned: !feed.is_pinned });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/:id/feed/:fid/comments
router.get('/:id/feed/:fid/comments', requireMember, async (req, res) => {
    try {
        const [comments] = await db.query(`
            SELECT c.id, c.content, c.created_at,
                   u.id AS user_id, u.name AS user_name, e.profile_image
            FROM feed_comments c
            INNER JOIN users u ON c.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE c.feed_id=? AND c.is_deleted=0
            ORDER BY c.created_at ASC
        `, [req.params.fid]);
        res.json({ success: true, comments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/feed/:fid/comments
router.post('/:id/feed/:fid/comments', requireMember, canWrite, async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: '댓글을 입력해주세요.' });
    try {
        const [r] = await db.query(
            'INSERT INTO feed_comments (feed_id,user_id,content) VALUES (?,?,?)',
            [req.params.fid, req.user.id, content.trim()]
        );
        const [[comment]] = await db.query(`
            SELECT c.id, c.content, c.created_at,
                   u.id AS user_id, u.name AS user_name, e.profile_image
            FROM feed_comments c
            INNER JOIN users u ON c.user_id=u.id
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE c.id=?
        `, [r.insertId]);

        // 게시글 작성자에게 알림
        const [[feed]] = await db.query('SELECT user_id FROM project_feeds WHERE id=?', [req.params.fid]);
        if (feed && feed.user_id !== req.user.id) {
            await pushNotif(feed.user_id, {
                title: '게시글에 댓글이 달렸습니다.',
                body:  `${req.user.name}: ${content.substring(0, 60)}`,
                url:   `/project/${req.params.id}?tab=feed`
            });
        }
        res.status(201).json({ success: true, comment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/feed/:fid/comments/:cid
router.delete('/:id/feed/:fid/comments/:cid', requireMember, canWrite, async (req, res) => {
    try {
        const [[c]] = await db.query('SELECT user_id FROM feed_comments WHERE id=?', [req.params.cid]);
        if (!c) return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });
        const isManager = ['owner','manager'].includes(req.projectRole);
        if (!isManager && c.user_id !== req.user.id)
            return res.status(403).json({ success: false, message: '본인 댓글만 삭제할 수 있습니다.' });
        await db.query('UPDATE feed_comments SET is_deleted=1 WHERE id=?', [req.params.cid]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/feed/:fid/todo/:iid  ─  할 일 체크 토글
router.patch('/:id/feed/:fid/todo/:iid', requireMember, async (req, res) => {
    try {
        const [[item]] = await db.query('SELECT * FROM feed_todo_items WHERE id=? AND feed_id=?', [req.params.iid, req.params.fid]);
        if (!item) return res.status(404).json({ success: false, message: '항목 없음' });
        const done = item.is_done ? 0 : 1;
        await db.query(
            'UPDATE feed_todo_items SET is_done=?, done_by=?, done_at=? WHERE id=?',
            [done, done ? req.user.id : null, done ? new Date() : null, item.id]
        );
        res.json({ success: true, is_done: done });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/feed/:fid/vote  ─  투표하기 (토글)
router.post('/:id/feed/:fid/vote', requireMember, async (req, res) => {
    const { option_id } = req.body;
    if (!option_id) return res.status(400).json({ success: false, message: 'option_id 필요' });
    try {
        const [[feed]] = await db.query('SELECT post_meta FROM project_feeds WHERE id=? AND project_id=?', [req.params.fid, req.params.id]);
        if (!feed) return res.status(404).json({ success: false, message: '피드 없음' });

        const meta = typeof feed.post_meta === 'string' ? JSON.parse(feed.post_meta || '{}') : (feed.post_meta || {});
        const multiple = meta.multiple;

        const [[existing]] = await db.query(
            'SELECT id FROM feed_poll_votes WHERE feed_id=? AND option_id=? AND user_id=?',
            [req.params.fid, option_id, req.user.id]
        );

        if (existing) {
            // 이미 투표 → 취소
            await db.query('DELETE FROM feed_poll_votes WHERE id=?', [existing.id]);
        } else {
            if (!multiple) {
                // 단일 투표: 기존 투표 제거 후 새로 추가
                await db.query('DELETE FROM feed_poll_votes WHERE feed_id=? AND user_id=?', [req.params.fid, req.user.id]);
            }
            await db.query(
                'INSERT INTO feed_poll_votes (feed_id,option_id,user_id) VALUES (?,?,?)',
                [req.params.fid, option_id, req.user.id]
            );
        }

        // 최신 집계 반환
        const [opts] = await db.query(`
            SELECT o.id, COUNT(v.id) AS vote_count,
                   MAX(CASE WHEN v.user_id=? THEN 1 ELSE 0 END) AS my_vote
            FROM feed_poll_options o
            LEFT JOIN feed_poll_votes v ON o.id=v.option_id
            WHERE o.feed_id=?
            GROUP BY o.id ORDER BY o.sort_order, o.id
        `, [req.user.id, req.params.fid]);

        res.json({ success: true, options: opts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 커스텀 컬럼
// ============================================================

// GET /projects/:id/custom-columns
router.get('/:id/custom-columns', requireMember, async (req, res) => {
    try {
        const [cols] = await db.query(
            'SELECT * FROM project_custom_columns WHERE project_id=? ORDER BY sort_order, id',
            [req.params.id]
        );
        res.json({ success: true, columns: cols });
    } catch {
        res.json({ success: true, columns: [] });
    }
});

// POST /projects/:id/custom-columns
router.post('/:id/custom-columns', requireMember, requireManager, async (req, res) => {
    try {
        const { name, field_type = 'text', description } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: '항목명 필요' });
        const [[{ maxOrder }]] = await db.query(
            'SELECT COALESCE(MAX(sort_order),0) AS maxOrder FROM project_custom_columns WHERE project_id=?',
            [req.params.id]
        );
        const [r] = await db.query(
            'INSERT INTO project_custom_columns (project_id,name,field_type,description,sort_order) VALUES (?,?,?,?,?)',
            [req.params.id, name.trim(), field_type, description?.trim() || null, maxOrder + 1]
        );
        const [[col]] = await db.query('SELECT * FROM project_custom_columns WHERE id=?', [r.insertId]);
        res.status(201).json({ success: true, column: col });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/custom-columns/:cid
router.delete('/:id/custom-columns/:cid', requireMember, requireManager, async (req, res) => {
    try {
        await db.query('DELETE FROM project_custom_columns WHERE id=? AND project_id=?', [req.params.cid, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PATCH /projects/:id/tasks/:tid/custom-values  ─  커스텀 값 저장
router.patch('/:id/tasks/:tid/custom-values', requireMember, canWrite, async (req, res) => {
    try {
        const { column_id, value } = req.body;
        if (!column_id) return res.status(400).json({ success: false, message: 'column_id 필요' });
        await db.query(
            'INSERT INTO task_custom_values (task_id,column_id,value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',
            [req.params.tid, column_id, value ?? '']
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 파일 탭
// ============================================================

// GET /projects/:id/files/folders
router.get('/:id/files/folders', requireMember, async (req, res) => {
    try {
        const [folders] = await db.query(`
            SELECT f.*, u.name AS created_by_name
            FROM project_file_folders f
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.project_id=? ORDER BY f.parent_id IS NULL DESC, f.name
        `, [req.params.id]);
        res.json({ success: true, folders });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/files/folders
router.post('/:id/files/folders', requireMember, canWrite, async (req, res) => {
    try {
        const { name, parent_id } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: '폴더 이름 필요' });
        const [r] = await db.query(
            'INSERT INTO project_file_folders (project_id,parent_id,name,created_by) VALUES (?,?,?,?)',
            [req.params.id, parent_id || null, name.trim(), req.user.id]
        );
        const [[folder]] = await db.query(
            'SELECT f.*, u.name AS created_by_name FROM project_file_folders f LEFT JOIN users u ON f.created_by=u.id WHERE f.id=?',
            [r.insertId]
        );
        res.status(201).json({ success: true, folder });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/files/folders/:folderid
router.delete('/:id/files/folders/:folderid', requireMember, async (req, res) => {
    try {
        const [[folder]] = await db.query(
            'SELECT * FROM project_file_folders WHERE id=? AND project_id=?',
            [req.params.folderid, req.params.id]
        );
        if (!folder) return res.status(404).json({ success: false, message: '폴더 없음' });
        const isManager = ['owner','manager'].includes(req.projectRole);
        if (!isManager && folder.created_by !== req.user.id)
            return res.status(403).json({ success: false, message: '권한 없음' });

        const [files] = await db.query('SELECT file_path FROM project_files WHERE folder_id=?', [req.params.folderid]);
        for (const f of files) { try { fs.unlinkSync(f.file_path); } catch {} }
        await db.query('DELETE FROM project_files WHERE folder_id=?', [req.params.folderid]);
        await db.query('DELETE FROM project_file_folders WHERE id=?', [req.params.folderid]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/:id/files
router.get('/:id/files', requireMember, async (req, res) => {
    try {
        const folderId = req.query.folder_id || null;
        const [files] = await db.query(
            `SELECT pf.*, u.name AS uploaded_by_name
             FROM project_files pf LEFT JOIN users u ON pf.uploaded_by=u.id
             WHERE pf.project_id=? AND ${folderId ? 'pf.folder_id=?' : 'pf.folder_id IS NULL'}
             ORDER BY pf.created_at DESC`,
            folderId ? [req.params.id, folderId] : [req.params.id]
        );
        res.json({ success: true, files });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /projects/:id/files
router.post('/:id/files', requireMember, canWrite, projectFileUpload.array('files', 10), async (req, res) => {
    try {
        if (!req.files?.length) return res.status(400).json({ success: false, message: '파일 없음' });
        const folderId = req.body.folder_id || null;
        const inserted = [];
        for (const file of req.files) {
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const [r] = await db.query(
                'INSERT INTO project_files (project_id,folder_id,uploaded_by,file_name,file_path,file_size,mime_type) VALUES (?,?,?,?,?,?,?)',
                [req.params.id, folderId || null, req.user.id, originalName, file.path, file.size, file.mimetype]
            );
            const [[f]] = await db.query(
                'SELECT pf.*, u.name AS uploaded_by_name FROM project_files pf LEFT JOIN users u ON pf.uploaded_by=u.id WHERE pf.id=?',
                [r.insertId]
            );
            inserted.push(f);
        }
        res.status(201).json({ success: true, files: inserted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /projects/:id/files/:fid/download
router.get('/:id/files/:fid/download', requireMember, async (req, res) => {
    try {
        const [[f]] = await db.query('SELECT * FROM project_files WHERE id=? AND project_id=?', [req.params.fid, req.params.id]);
        if (!f) return res.status(404).json({ success: false, message: '파일 없음' });
        res.download(f.file_path, f.file_name);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /projects/:id/files/:fid
router.delete('/:id/files/:fid', requireMember, async (req, res) => {
    try {
        const [[f]] = await db.query('SELECT * FROM project_files WHERE id=? AND project_id=?', [req.params.fid, req.params.id]);
        if (!f) return res.status(404).json({ success: false, message: '파일 없음' });
        const isManager = ['owner','manager'].includes(req.projectRole);
        if (!isManager && f.uploaded_by !== req.user.id)
            return res.status(403).json({ success: false, message: '본인 파일만 삭제 가능' });
        try { fs.unlinkSync(f.file_path); } catch {}
        await db.query('DELETE FROM project_files WHERE id=?', [req.params.fid]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 인사이트 탭
// ============================================================

// GET /projects/:id/insights
router.get('/:id/insights', requireMember, async (req, res) => {
    try {
        const pid = req.params.id;

        const [[total]] = await db.query(`
            SELECT COUNT(*) AS total,
                   SUM(status='done') AS done,
                   SUM(status='in_progress') AS in_progress,
                   SUM(status='todo') AS todo,
                   SUM(status='on_hold') AS on_hold,
                   ROUND(AVG(progress),1) AS avg_progress
            FROM tasks WHERE project_id=?
        `, [pid]);

        const [byGroup] = await db.query(`
            SELECT tg.id, tg.name, tg.color,
                   COUNT(t.id) AS total,
                   SUM(t.status='done') AS done
            FROM task_groups tg
            LEFT JOIN tasks t ON t.group_id=tg.id
            WHERE tg.project_id=?
            GROUP BY tg.id ORDER BY tg.sort_order
        `, [pid]);

        const [byPriority] = await db.query(`
            SELECT priority, COUNT(*) AS cnt
            FROM tasks WHERE project_id=?
            GROUP BY priority
        `, [pid]);

        const [recentActivity] = await db.query(`
            SELECT DATE(created_at) AS day, COUNT(*) AS cnt
            FROM project_activity_logs
            WHERE project_id=? AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            GROUP BY DATE(created_at) ORDER BY day ASC
        `, [pid]);

        res.json({ success: true, total, byGroup, byPriority, recentActivity });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================================
// 활동 로그
// ============================================================

// GET /projects/:id/activity
router.get('/:id/activity', requireMember, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit)  || 30, 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        const [logs] = await db.query(`
            SELECT pal.*, u.name AS user_name, e.profile_image,
                   t.title AS task_title
            FROM project_activity_logs pal
            INNER JOIN users u ON pal.user_id = u.id
            LEFT JOIN employees e ON u.id = e.user_id
            LEFT JOIN tasks t ON pal.task_id = t.id
            WHERE pal.project_id=?
            ORDER BY pal.created_at DESC
            LIMIT ? OFFSET ?
        `, [req.params.id, limit, offset]);
        res.json({ success: true, logs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

module.exports = router;
