// ============================================
// routes/approvalAdmin.js  ─  관리자 결재 API
// ============================================
const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const db = require('../config/database');

router.use(authMiddleware);
router.use(adminMiddleware);

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────
const toJson = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
};

const safeParse = (v, fallback = []) => {
    if (!v) return fallback;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return fallback; }
};

// ─────────────────────────────────────────
// 카테고리
// ─────────────────────────────────────────

router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT c.*, COUNT(t.id) AS template_count
             FROM approval_template_categories c
             LEFT JOIN approval_templates t ON c.id = t.category_id AND t.is_active = TRUE
             GROUP BY c.id ORDER BY c.order_no, c.id`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, message: '이름 필수' });
        const [[{ maxOrder }]] = await db.query(
            `SELECT COALESCE(MAX(order_no),0) AS maxOrder FROM approval_template_categories`
        );
        const [result] = await db.query(
            `INSERT INTO approval_template_categories (name, order_no) VALUES (?, ?)`,
            [name.trim(), maxOrder + 1]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        res.status(500).json({ success: false, message: '생성 실패' });
    }
});

router.put('/categories/reorder', async (req, res) => {
    try {
        const { order } = req.body;
        for (const item of order) {
            await db.query(`UPDATE approval_template_categories SET order_no=? WHERE id=?`, [item.order_no, item.id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '순서 저장 실패' });
    }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const { name, is_active } = req.body;
        const fields = [], vals = [];
        if (name !== undefined)      { fields.push('name=?');      vals.push(name); }
        if (is_active !== undefined) { fields.push('is_active=?'); vals.push(is_active); }
        if (!fields.length) return res.status(400).json({ success: false, message: '수정할 내용 없음' });
        vals.push(req.params.id);
        await db.query(`UPDATE approval_template_categories SET ${fields.join(',')} WHERE id=?`, vals);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '수정 실패' });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        const [[{ cnt }]] = await db.query(
            `SELECT COUNT(*) AS cnt FROM approval_templates WHERE category_id=? AND is_active=TRUE`, [req.params.id]
        );
        if (cnt > 0)
            return res.status(400).json({ success: false, message: `활성 서식 ${cnt}개가 있습니다.` });
        await db.query(`DELETE FROM approval_template_categories WHERE id=?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '삭제 실패' });
    }
});

// ─────────────────────────────────────────
// 서식
// ─────────────────────────────────────────

router.get('/templates', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.*, c.name AS category_name
             FROM approval_templates t
             JOIN approval_template_categories c ON t.category_id = c.id
             ORDER BY c.order_no, t.order_no, t.id`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/approval/admin/templates/:id  ─ 상세 (결재선 포함)
router.get('/templates/:id', async (req, res) => {
    try {
        const [[tmpl]] = await db.query(
            `SELECT t.*, c.name AS category_name
             FROM approval_templates t
             JOIN approval_template_categories c ON t.category_id = c.id
             WHERE t.id = ?`, [req.params.id]
        );
        if (!tmpl) return res.status(404).json({ success: false, message: '서식 없음' });

        // 결재선 목록
        const [lines] = await db.query(
            `SELECT * FROM approval_template_lines WHERE template_id=? ORDER BY order_no, id`,
            [req.params.id]
        );
        tmpl.template_lines = lines;
        res.json({ success: true, data: tmpl });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

router.post('/templates', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const {
            category_id, name, description, form_fields,
            // 결재 명칭
            approval_name, ref_name, agree_name, parallel_name, parallel_agree_name,
            // 결재선 설정
            approval_line_required, admin_approval_line, approval_line_changeable,
            skip_no_superior, predecision_enabled, default_line_enabled,
            conditional_line_enabled, approval_lines,
            editable_in_progress,
            // 수신
            receiver_enabled, receiver_timing, receivers, receiver_changeable,
            // 공유
            share_range, share_timing, share_targets, share_changeable,
            // 권한
            view_targets, regulation,
        } = req.body;

        if (!category_id || !name?.trim())
            return res.status(400).json({ success: false, message: '카테고리와 서식명 필수' });

        const [[{ maxOrder }]] = await conn.query(
            `SELECT COALESCE(MAX(order_no),0) AS maxOrder FROM approval_templates WHERE category_id=?`,
            [category_id]
        );

        const [result] = await conn.query(
            `INSERT INTO approval_templates
             (category_id, name, description, form_fields,
              approval_name, ref_name, agree_name, parallel_name, parallel_agree_name,
              approval_line_required, admin_approval_line, approval_line_changeable,
              skip_no_superior, predecision_enabled, default_line_enabled,
              conditional_line_enabled, approval_lines, editable_in_progress,
              receiver_enabled, receiver_timing, receivers, receiver_changeable,
              share_range, share_timing, share_targets, share_changeable,
              view_targets, regulation, order_no)
             VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?)`,
            [
                category_id, name.trim(), description || null, toJson(form_fields),
                approval_name || '결재', ref_name || '참조', agree_name || '합의',
                parallel_name || '병렬 결재', parallel_agree_name || '병렬 합의',
                approval_line_required ? 1 : 0,
                admin_approval_line ? 1 : 0,
                approval_line_changeable !== false ? 1 : 0,
                skip_no_superior ? 1 : 0,
                predecision_enabled ? 1 : 0,
                default_line_enabled !== false ? 1 : 0,
                conditional_line_enabled ? 1 : 0,
                toJson(approval_lines),
                editable_in_progress ? 1 : 0,
                receiver_enabled !== false ? 1 : 0,
                receiver_timing || '문서 작성 시점부터 수신',
                toJson(receivers), receiver_changeable !== false ? 1 : 0,
                share_range || '일부 공유',
                share_timing || '완료된 후 공유',
                toJson(share_targets), share_changeable !== false ? 1 : 0,
                toJson(view_targets),
                regulation || null,
                maxOrder + 1,
            ]
        );

        const templateId = result.insertId;

        // 결재선 별도 저장
        const lineList = safeParse(approval_lines, []);
        for (let i = 0; i < lineList.length; i++) {
            const line = lineList[i];
            await conn.query(
                `INSERT INTO approval_template_lines (template_id, line_key, label, is_conditional, approvers, order_no)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [templateId, line.id || `line_${i}`, line.label || '기본',
                 line.conditional ? 1 : 0, toJson(line.approvers || []), i]
            );
        }

        await conn.commit();
        res.status(201).json({ success: true, data: { id: templateId } });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: '생성 실패' });
    } finally {
        conn.release();
    }
});

router.put('/templates/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const UPDATABLE = [
            'category_id','name','description','form_fields',
            'approval_name','ref_name','agree_name','parallel_name','parallel_agree_name',
            'approval_line_required','admin_approval_line','approval_line_changeable',
            'skip_no_superior','predecision_enabled','default_line_enabled',
            'conditional_line_enabled','approval_lines','editable_in_progress',
            'is_active',
            'receiver_enabled','receiver_timing','receivers','receiver_changeable',
            'share_range','share_timing','share_targets','share_changeable',
            'view_targets',
            'regulation',
        ];

        const JSON_FIELDS = new Set(['form_fields','approval_lines','receivers','share_targets','view_targets']);
        const BOOL_FIELDS = new Set([
            'approval_line_required','admin_approval_line','approval_line_changeable',
            'skip_no_superior','predecision_enabled','default_line_enabled',
            'conditional_line_enabled','editable_in_progress','is_active',
            'receiver_enabled','receiver_changeable','share_changeable',
        ]);

        const fields = [], vals = [];
        for (const key of UPDATABLE) {
            if (req.body[key] === undefined) continue;
            fields.push(`${key}=?`);
            if (JSON_FIELDS.has(key))  vals.push(toJson(req.body[key]));
            else if (BOOL_FIELDS.has(key)) vals.push(req.body[key] ? 1 : 0);
            else vals.push(req.body[key]);
        }

        if (fields.length) {
            vals.push(req.params.id);
            await conn.query(`UPDATE approval_templates SET ${fields.join(',')} WHERE id=?`, vals);
        }

        // 결재선 재저장 (approval_lines가 전달된 경우)
        if (req.body.approval_lines !== undefined) {
            await conn.query(`DELETE FROM approval_template_lines WHERE template_id=?`, [req.params.id]);
            const lineList = safeParse(req.body.approval_lines, []);
            for (let i = 0; i < lineList.length; i++) {
                const line = lineList[i];
                await conn.query(
                    `INSERT INTO approval_template_lines (template_id, line_key, label, is_conditional, approvers, order_no)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [req.params.id, line.id || `line_${i}`, line.label || '기본',
                     line.conditional ? 1 : 0, toJson(line.approvers || []), i]
                );
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: '수정 실패' });
    } finally {
        conn.release();
    }
});

router.delete('/templates/:id', async (req, res) => {
    try {
        const [[{ cnt }]] = await db.query(
            `SELECT COUNT(*) AS cnt FROM approval_documents WHERE template_id=?`, [req.params.id]
        );
        if (cnt > 0) {
            await db.query(`UPDATE approval_templates SET is_active=FALSE WHERE id=?`, [req.params.id]);
        } else {
            await db.query(`DELETE FROM approval_template_lines WHERE template_id=?`, [req.params.id]);
            await db.query(`DELETE FROM approval_templates WHERE id=?`, [req.params.id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '삭제 실패' });
    }
});

// ─────────────────────────────────────────
// 서식별 결재선 개별 관리 API
// ─────────────────────────────────────────

// GET /api/approval/admin/templates/:id/lines
router.get('/templates/:id/lines', async (req, res) => {
    try {
        const [lines] = await db.query(
            `SELECT * FROM approval_template_lines WHERE template_id=? ORDER BY order_no, id`,
            [req.params.id]
        );
        res.json({ success: true, data: lines });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /api/approval/admin/templates/:id/lines
router.post('/templates/:id/lines', async (req, res) => {
    try {
        const { label, approvers, is_conditional, condition_json } = req.body;
        const [[{ maxOrder }]] = await db.query(
            `SELECT COALESCE(MAX(order_no),0) AS maxOrder FROM approval_template_lines WHERE template_id=?`,
            [req.params.id]
        );
        const [result] = await db.query(
            `INSERT INTO approval_template_lines (template_id, line_key, label, is_conditional, condition_json, approvers, order_no)
             VALUES (?,?,?,?,?,?,?)`,
            [req.params.id, `line_${Date.now()}`, label || '기본',
             is_conditional ? 1 : 0, toJson(condition_json), toJson(approvers || []), maxOrder + 1]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        res.status(500).json({ success: false, message: '생성 실패' });
    }
});

// PUT /api/approval/admin/templates/:id/lines/:lineId
router.put('/templates/:id/lines/:lineId', async (req, res) => {
    try {
        const { label, approvers, is_conditional, condition_json, order_no } = req.body;
        const fields = [], vals = [];
        if (label !== undefined)         { fields.push('label=?');          vals.push(label); }
        if (approvers !== undefined)     { fields.push('approvers=?');       vals.push(toJson(approvers)); }
        if (is_conditional !== undefined){ fields.push('is_conditional=?');  vals.push(is_conditional ? 1 : 0); }
        if (condition_json !== undefined){ fields.push('condition_json=?');  vals.push(toJson(condition_json)); }
        if (order_no !== undefined)      { fields.push('order_no=?');        vals.push(order_no); }
        if (!fields.length) return res.status(400).json({ success: false, message: '수정할 내용 없음' });
        vals.push(req.params.lineId, req.params.id);
        await db.query(`UPDATE approval_template_lines SET ${fields.join(',')} WHERE id=? AND template_id=?`, vals);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '수정 실패' });
    }
});

// DELETE /api/approval/admin/templates/:id/lines/:lineId
router.delete('/templates/:id/lines/:lineId', async (req, res) => {
    try {
        await db.query(
            `DELETE FROM approval_template_lines WHERE id=? AND template_id=?`,
            [req.params.lineId, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '삭제 실패' });
    }
});

// ─────────────────────────────────────────
// 결재 문서 (관리자 전체 조회)
// ─────────────────────────────────────────

router.get('/documents', async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const conditions = [], params = [];

        if (status) { conditions.push('d.status=?'); params.push(status); }
        if (search) {
            conditions.push('(d.title LIKE ? OR u.name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM approval_documents d JOIN users u ON d.drafter_id = u.id ${where}`,
            params
        );
        const [documents] = await db.query(
            `SELECT d.*, t.name AS template_name,
                    u.name AS drafter_name, dept.name AS drafter_dept
             FROM approval_documents d
             LEFT JOIN approval_templates t ON d.template_id = t.id
             JOIN users u ON d.drafter_id = u.id
             LEFT JOIN departments dept ON d.department_id = dept.id
             ${where} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(limit), Number(offset)]
        );
        res.json({
            success: true,
            data: { documents, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) } }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

router.put('/documents/:id/cancel', async (req, res) => {
    try {
        const [[doc]] = await db.query(`SELECT * FROM approval_documents WHERE id=?`, [req.params.id]);
        if (!doc) return res.status(404).json({ success: false, message: '문서 없음' });
        if (!['PENDING','IN_PROGRESS'].includes(doc.status))
            return res.status(400).json({ success: false, message: '취소 불가 상태' });
        await db.query(`UPDATE approval_documents SET status='CANCELLED', completed_at=NOW() WHERE id=?`, [req.params.id]);
        await db.query(
            `UPDATE approval_lines SET status='SKIPPED' WHERE document_id=? AND status IN ('PENDING','WAITING')`,
            [req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '취소 실패' });
    }
});

// ─────────────────────────────────────────
// 결재선 예외
// ─────────────────────────────────────────

router.get('/line-exceptions', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ale.*,
                    uf.name AS from_name,
                    df.name AS from_dept,
                    ut.name AS to_name,
                    dt.name AS to_dept,
                    t.name  AS template_name,
                    dep.name AS dept_name
             FROM approval_line_exceptions ale
             JOIN users uf ON ale.from_user_id = uf.id
             LEFT JOIN employees ef ON uf.id = ef.user_id
             LEFT JOIN departments df ON ef.department_id = df.id
             LEFT JOIN users ut ON ale.to_user_id = ut.id
             LEFT JOIN employees et ON ut.id = et.user_id
             LEFT JOIN departments dt ON et.department_id = dt.id
             LEFT JOIN approval_templates t ON ale.template_id = t.id
             LEFT JOIN departments dep ON ale.dept_id = dep.id
             ORDER BY ale.created_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

router.post('/line-exceptions', async (req, res) => {
    try {
        const {
            from_user_id, to_user_id,
            exception_type = 'change',
            template_scope = 'all', template_id,
            dept_scope = 'all', dept_id,
        } = req.body;

        if (!from_user_id)
            return res.status(400).json({ success: false, message: '원결재자 필수' });
        if (exception_type !== 'skip' && !to_user_id)
            return res.status(400).json({ success: false, message: '변경/참조 결재자 필수' });
        if (to_user_id && String(from_user_id) === String(to_user_id))
            return res.status(400).json({ success: false, message: '동일인 지정 불가' });

        const [result] = await db.query(
            `INSERT INTO approval_line_exceptions
             (from_user_id, to_user_id, exception_type, template_scope, template_id, dept_scope, dept_id)
             VALUES (?,?,?,?,?,?,?)`,
            [
                from_user_id,
                exception_type === 'skip' ? null : to_user_id,
                exception_type,
                template_scope,
                template_scope === 'specific' && template_id ? template_id : null,
                dept_scope,
                dept_scope === 'specific' && dept_id ? dept_id : null,
            ]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '생성 실패' });
    }
});

router.delete('/line-exceptions/:id', async (req, res) => {
    try {
        await db.query(`DELETE FROM approval_line_exceptions WHERE id=?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '삭제 실패' });
    }
});

module.exports = router;