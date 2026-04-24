// ============================================
// routes/approval.js  ─  일반 사용자 결재 API
// ============================================
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const { logActivity } = require('../utils/logger');
const { sendApprovalRequest, sendApprovalComplete, sendApprovalRejected } = require('../utils/mailer');
const { validateMimeType } = require('../utils/mimeCheck');

// 이메일 fire-and-forget 헬퍼
function mailSilent(fn) { fn().catch(err => console.error('메일 발송 실패:', err.message)); }

// 유저 이메일 조회
async function getUserEmail(userId) {
    const [[u]] = await db.query('SELECT email, name FROM users WHERE id = ?', [userId]);
    return u || null;
}
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 결재 첨부파일 업로드 설정
const uploadDir = path.join(__dirname, '../uploads/approval');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(original);
        const name = path.basename(original, ext);
        cb(null, name + '-' + Date.now() + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg','.jpeg','.png','.gif','.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.zip','.txt','.hwp'];
        const ext = path.extname(Buffer.from(file.originalname,'latin1').toString('utf8')).toLowerCase();
        allowed.includes(ext) ? cb(null, true) : cb(new Error('허용되지 않는 파일 형식입니다.'));
    }
});

router.use(authMiddleware);

// 문서번호 생성 유틸
const genDocNumber = async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM approval_documents
         WHERE DATE(created_at) = CURDATE()`
    );
    return `APV-${today}-${String(cnt + 1).padStart(3, '0')}`;
};

// ─────────────────────────────────────────
// 서식 조회 (공개용)
// ─────────────────────────────────────────

// GET /api/approval/templates  ─ 전체 서식 목록 (카테고리별)
router.get('/templates', async (req, res) => {
    try {
        const [categories] = await db.query(
            `SELECT id, name FROM approval_template_categories
             WHERE is_active = TRUE ORDER BY order_no, id`
        );
        const [templates] = await db.query(
            `SELECT t.*, c.name AS category_name
             FROM approval_templates t
             JOIN approval_template_categories c ON t.category_id = c.id
             WHERE t.is_active = TRUE
             ORDER BY c.order_no, t.order_no, t.id`
        );
        // 즐겨찾기
        const [favs] = await db.query(
            `SELECT template_id FROM approval_template_favorites WHERE user_id = ?`,
            [req.user.id]
        );
        const favSet = new Set(favs.map(f => f.template_id));

        const result = categories.map(cat => ({
            ...cat,
            templates: templates
                .filter(t => t.category_id === cat.id)
                .map(t => ({
                    ...t,
                    form_fields: JSON.parse(t.form_fields || '[]'),
                    is_favorite: favSet.has(t.id)
                }))
        }));

        // 최근 사용 서식 (최대 5개)
        const [recent] = await db.query(
            `SELECT DISTINCT d.template_id, t.name, t.id
             FROM approval_documents d
             JOIN approval_templates t ON d.template_id = t.id
             WHERE d.drafter_id = ? AND d.template_id IS NOT NULL
             ORDER BY d.created_at DESC LIMIT 5`,
            [req.user.id]
        );

        res.json({ success: true, data: { categories: result, recent, favorites: [...favSet] } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/approval/templates/:id  ─ 서식 상세
router.get('/templates/:id', async (req, res) => {
    try {
        const [[tmpl]] = await db.query(
            `SELECT t.*, c.name AS category_name
             FROM approval_templates t
             JOIN approval_template_categories c ON t.category_id = c.id
             WHERE t.id = ? AND t.is_active = TRUE`,
            [req.params.id]
        );
        if (!tmpl) return res.status(404).json({ success: false, message: '서식 없음' });
        tmpl.form_fields = JSON.parse(tmpl.form_fields || '[]');
        res.json({ success: true, data: tmpl });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /api/approval/templates/:id/favorite  ─ 즐겨찾기 토글
router.post('/templates/:id/favorite', async (req, res) => {
    try {
        const [[fav]] = await db.query(
            `SELECT id FROM approval_template_favorites WHERE user_id=? AND template_id=?`,
            [req.user.id, req.params.id]
        );
        if (fav) {
            await db.query(`DELETE FROM approval_template_favorites WHERE id=?`, [fav.id]);
            res.json({ success: true, data: { is_favorite: false } });
        } else {
            await db.query(
                `INSERT INTO approval_template_favorites (user_id, template_id) VALUES (?,?)`,
                [req.user.id, req.params.id]
            );
            res.json({ success: true, data: { is_favorite: true } });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ─────────────────────────────────────────
// 조직도 (결재선 설정용)
// ─────────────────────────────────────────

// GET /api/approval/org  ─ 부서 트리 + 사원 목록
router.get('/org', async (req, res) => {
    try {
        const [depts] = await db.query(
            `SELECT id, name, parent_id FROM departments WHERE is_active = TRUE ORDER BY name`
        );
        const [users] = await db.query(
            `SELECT u.id, u.name, e.department_id, e.position, e.job_title, d.name AS dept_name
             FROM users u
             JOIN employees e ON u.id = e.user_id
             JOIN departments d ON e.department_id = d.id
             WHERE u.is_active = TRUE AND e.status = 'ACTIVE'
             ORDER BY d.name, u.name`
        );
        res.json({ success: true, data: { departments: depts, users } });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ─────────────────────────────────────────
// 결재 문서
// ─────────────────────────────────────────

// GET /api/approval/documents  ─ 내 문서 목록
router.get('/documents', async (req, res) => {
    try {
        const { box = 'draft', page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;
        let where = '1=0'; // 기본값: 빈 결과 (box 미지정 방어)
        const whereParams = [];

        // box: draft(임시), my(내가 기안), inbox(수신-내가 결재자), done(처리완료), cc(참조)
        if (box === 'draft') {
            where = `d.drafter_id = ? AND d.status = 'DRAFT'`;
            whereParams.push(req.user.id);
        } else if (box === 'my') {
            where = `d.drafter_id = ? AND d.status NOT IN ('DRAFT','CANCELLED')`;
            whereParams.push(req.user.id);
        } else if (box === 'home') {
            where = `d.drafter_id = ? AND d.status NOT IN ('DRAFT','CANCELLED')`;
            whereParams.push(req.user.id);
        } else if (box === 'inbox') {
            where = `d.id IN (
                SELECT document_id FROM approval_lines
                WHERE approver_id = ?
            ) AND d.status IN ('PENDING','IN_PROGRESS')`;
            whereParams.push(req.user.id);
        } else if (box === 'done') {
            where = `d.id IN (
                SELECT document_id FROM approval_lines
                WHERE approver_id = ? AND status IN ('APPROVED','REJECTED')
            )`;
            whereParams.push(req.user.id);
        } else if (box === 'cc') {
            where = `d.id IN (
                SELECT document_id FROM approval_recipients WHERE user_id = ?
            )`;
            whereParams.push(req.user.id);
        }
        const searchParams = [...whereParams];
        const searchWhere = search ? ` AND d.title LIKE ?` : '';
        if (search) searchParams.push(`%${search}%`);

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM approval_documents d WHERE ${where}${searchWhere}`,
            searchParams
        );
        const [documents] = await db.query(
            `SELECT d.*, t.name AS template_name,
                    u.name AS drafter_name, dept.name AS drafter_dept
             FROM approval_documents d
             LEFT JOIN approval_templates t ON d.template_id = t.id
             JOIN users u ON d.drafter_id = u.id
             LEFT JOIN departments dept ON d.department_id = dept.id
             WHERE ${where}${searchWhere}
             ORDER BY d.updated_at DESC
             LIMIT ? OFFSET ?`,
            [...searchParams, Number(limit), Number(offset)]
        );

        res.json({
            success: true,
            data: {
                documents,
                pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/approval/documents/:id  ─ 문서 상세
router.get('/documents/:id', async (req, res) => {
    try {
        const [[doc]] = await db.query(
            `SELECT d.*, t.name AS template_name, t.form_fields AS template_fields,
                    u.name AS drafter_name, e.position AS drafter_position,
                    dept.name AS drafter_dept
             FROM approval_documents d
             LEFT JOIN approval_templates t ON d.template_id = t.id
             JOIN users u ON d.drafter_id = u.id
             LEFT JOIN employees e ON u.id = e.user_id
             LEFT JOIN departments dept ON d.department_id = dept.id
             WHERE d.id = ?`,
            [req.params.id]
        );
        if (!doc) return res.status(404).json({ success: false, message: '문서 없음' });

        const [lines] = await db.query(
            `SELECT al.*, u.name AS approver_name, u.signature_data, e.position, e.job_title, d.name AS dept_name
             FROM approval_lines al
             JOIN users u ON al.approver_id = u.id
             LEFT JOIN employees e ON u.id = e.user_id
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE al.document_id = ?
             ORDER BY al.step`,
            [req.params.id]
        );
        const [attachments] = await db.query(
            `SELECT * FROM approval_attachments WHERE document_id = ? ORDER BY created_at`,
            [req.params.id]
        );

        doc.form_data = JSON.parse(doc.form_data || '{}');
        doc.template_fields = JSON.parse(doc.template_fields || '[]');

        res.json({ success: true, data: { ...doc, lines, attachments } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// POST /api/approval/documents  ─ 문서 작성 (임시저장 or 상신)
router.post('/documents', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const {
            template_id, title, content, form_data,
            lines = [],      // [{approver_id, type, step}]
            recipients = [], // [{user_id, type}]
            submit = false   // true면 즉시 상신
        } = req.body;

        if (!title) return res.status(400).json({ success: false, message: '제목은 필수입니다.' });
        if (submit && lines.length === 0)
            return res.status(400).json({ success: false, message: '결재선을 설정해주세요.' });

        const status = submit ? 'PENDING' : 'DRAFT';
        const docNumber = submit ? await genDocNumber() : null;

        const [{ insertId: docId }] = await conn.query(
            `INSERT INTO approval_documents
             (doc_number, template_id, title, content, form_data,
              drafter_id, department_id, status, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                docNumber, template_id || null, title, content || '',
                JSON.stringify(form_data || {}),
                req.user.id, req.user.department_id, status,
                submit ? new Date() : null
            ]
        );

        // 결재선 저장
        for (const line of lines) {
            await conn.query(
                `INSERT INTO approval_lines (document_id, step, type, approver_id, status)
                 VALUES (?, ?, ?, ?, ?)`,
                [docId, line.step, line.type || 'APPROVAL', line.approver_id,
                 submit && line.step === 1 ? 'PENDING' : 'WAITING']
            );
        }

        // 수신처 저장
        for (const r of recipients) {
            await conn.query(
                `INSERT INTO approval_recipients (document_id, type, user_id) VALUES (?, ?, ?)`,
                [docId, r.type || 'CC', r.user_id]
            );
        }

        // 상신 시 첫 결재자에게 알림 + 이메일
        if (submit && lines.length > 0) {
            const firstApprover = lines.find(l => l.step === 1);
            if (firstApprover) {
                await conn.query(
                    `INSERT INTO approval_notifications (user_id, document_id, type, message)
                     VALUES (?, ?, 'REQUEST', ?)`,
                    [firstApprover.approver_id, docId, `'${title}' 결재 요청이 도착했습니다.`]
                );
                const [approver, drafter] = await Promise.all([
                    getUserEmail(firstApprover.approver_id),
                    getUserEmail(req.user.id),
                ]);
                if (approver?.email) {
                    mailSilent(() => sendApprovalRequest({
                        to: approver.email,
                        approverName: approver.name,
                        drafterName: drafter?.name || req.user.name,
                        docTitle: title,
                        docNumber,
                        docUrl: `${process.env.APP_URL}/approval/documents/${docId}`,
                    }));
                }
            }
        }

        await conn.commit();

        if (submit) {
            logActivity('info', `결재 상신: "${title}" (문서번호: ${docNumber}, 기안자: ${req.user.name})`, { userId: req.user.id, req });
        }

        res.status(201).json({ success: true, data: { id: docId, doc_number: docNumber } });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: '저장 실패' });
    } finally {
        conn.release();
    }
});

// PUT /api/approval/documents/:id  ─ 임시저장 수정
router.put('/documents/:id', async (req, res) => {
    try {
        const [[doc]] = await db.query(
            `SELECT * FROM approval_documents WHERE id=? AND drafter_id=?`,
            [req.params.id, req.user.id]
        );
        if (!doc) return res.status(404).json({ success: false, message: '문서 없음' });
        if (doc.status !== 'DRAFT')
            return res.status(400).json({ success: false, message: '임시저장 문서만 수정 가능합니다.' });

        const { title, content, form_data, lines = [], recipients = [], submit = false } = req.body;
        const status = submit ? 'PENDING' : 'DRAFT';
        const docNumber = submit ? await genDocNumber() : doc.doc_number;

        await db.query(
            `UPDATE approval_documents SET title=?, content=?, form_data=?,
             status=?, doc_number=?, submitted_at=? WHERE id=?`,
            [title, content, JSON.stringify(form_data || {}), status, docNumber,
             submit ? new Date() : null, req.params.id]
        );

        // 결재선 재설정
        await db.query(`DELETE FROM approval_lines WHERE document_id=?`, [req.params.id]);
        for (const line of lines) {
            await db.query(
                `INSERT INTO approval_lines (document_id, step, type, approver_id, status)
                 VALUES (?, ?, ?, ?, ?)`,
                [req.params.id, line.step, line.type || 'APPROVAL', line.approver_id,
                 submit && line.step === 1 ? 'PENDING' : 'WAITING']
            );
        }

        // 수신처 재설정
        await db.query(`DELETE FROM approval_recipients WHERE document_id=?`, [req.params.id]);
        for (const r of recipients) {
            await db.query(
                `INSERT INTO approval_recipients (document_id, type, user_id) VALUES (?, ?, ?)`,
                [req.params.id, r.type || 'CC', r.user_id]
            );
        }

        res.json({ success: true, data: { doc_number: docNumber } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '수정 실패' });
    }
});

// DELETE /api/approval/documents/:id  ─ 임시저장 삭제
router.delete('/documents/:id', async (req, res) => {
    try {
        const [[doc]] = await db.query(
            `SELECT * FROM approval_documents WHERE id=? AND drafter_id=?`,
            [req.params.id, req.user.id]
        );
        if (!doc) return res.status(404).json({ success: false, message: '문서 없음' });
        if (doc.status !== 'DRAFT')
            return res.status(400).json({ success: false, message: '임시저장만 삭제 가능합니다.' });

        await db.query(`DELETE FROM approval_documents WHERE id=?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '삭제 실패' });
    }
});

// POST /api/approval/documents/:id/cancel  ─ 상신 취소 (기안자)
router.post('/documents/:id/cancel', async (req, res) => {
    try {
        const [[doc]] = await db.query(
            `SELECT * FROM approval_documents WHERE id=? AND drafter_id=?`,
            [req.params.id, req.user.id]
        );
        if (!doc) return res.status(404).json({ success: false, message: '문서 없음' });
        if (!['PENDING', 'IN_PROGRESS'].includes(doc.status))
            return res.status(400).json({ success: false, message: '취소할 수 없는 상태입니다.' });

        await db.query(
            `UPDATE approval_documents SET status='CANCELLED', completed_at=NOW() WHERE id=?`,
            [req.params.id]
        );
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
// 결재 처리 (승인 / 반려)
// ─────────────────────────────────────────

// POST /api/approval/documents/:id/action
router.post('/documents/:id/action', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { action, comment } = req.body; // action: 'APPROVED' | 'REJECTED'
        if (!['APPROVED', 'REJECTED'].includes(action))
            return res.status(400).json({ success: false, message: 'action 값 오류' });

        const [[doc]] = await conn.query(
            `SELECT * FROM approval_documents WHERE id=?`, [req.params.id]
        );
        if (!doc || !['PENDING', 'IN_PROGRESS'].includes(doc.status))
            return res.status(400).json({ success: false, message: '처리할 수 없는 문서입니다.' });

        // 현재 내 결재 라인 찾기
        const [[myLine]] = await conn.query(
            `SELECT * FROM approval_lines
             WHERE document_id=? AND approver_id=? AND status='PENDING'`,
            [req.params.id, req.user.id]
        );
        if (!myLine)
            return res.status(403).json({ success: false, message: '결재 권한이 없거나 이미 처리되었습니다.' });

        // 현재 라인 처리
        await conn.query(
            `UPDATE approval_lines SET status=?, comment=?, actioned_at=NOW() WHERE id=?`,
            [action, comment || null, myLine.id]
        );

        if (action === 'REJECTED') {
            // 반려 → 문서 반려 처리
            await conn.query(
                `UPDATE approval_documents SET status='REJECTED', completed_at=NOW() WHERE id=?`,
                [req.params.id]
            );
            await conn.query(
                `UPDATE approval_lines SET status='SKIPPED' WHERE document_id=? AND status='WAITING'`,
                [req.params.id]
            );
            // 기안자에게 알림 + 이메일
            await conn.query(
                `INSERT INTO approval_notifications (user_id, document_id, type, message)
                 VALUES (?, ?, 'REJECTED', ?)`,
                [doc.drafter_id, req.params.id, `'${doc.title}' 문서가 반려되었습니다.`]
            );
            const drafter = await getUserEmail(doc.drafter_id);
            if (drafter?.email) {
                mailSilent(() => sendApprovalRejected({
                    to: drafter.email,
                    drafterName: drafter.name,
                    docTitle: doc.title,
                    docNumber: doc.doc_number,
                    rejectorName: req.user.name,
                    comment,
                    docUrl: `${process.env.APP_URL}/approval/documents/${req.params.id}`,
                }));
            }
        } else {
            // 승인 → 다음 결재자 활성화
            const [[nextLine]] = await conn.query(
                `SELECT * FROM approval_lines
                 WHERE document_id=? AND step > ? AND type != 'REFERENCE'
                 ORDER BY step LIMIT 1`,
                [req.params.id, myLine.step]
            );

            if (nextLine) {
                await conn.query(
                    `UPDATE approval_lines SET status='PENDING' WHERE id=?`, [nextLine.id]
                );
                await conn.query(
                    `UPDATE approval_documents SET status='IN_PROGRESS', current_step=? WHERE id=?`,
                    [nextLine.step, req.params.id]
                );
                // 다음 결재자 알림 + 이메일
                await conn.query(
                    `INSERT INTO approval_notifications (user_id, document_id, type, message)
                     VALUES (?, ?, 'REQUEST', ?)`,
                    [nextLine.approver_id, req.params.id, `'${doc.title}' 결재 요청이 도착했습니다.`]
                );
                const nextApprover = await getUserEmail(nextLine.approver_id);
                if (nextApprover?.email) {
                    mailSilent(() => sendApprovalRequest({
                        to: nextApprover.email,
                        approverName: nextApprover.name,
                        drafterName: req.user.name,
                        docTitle: doc.title,
                        docNumber: doc.doc_number,
                        docUrl: `${process.env.APP_URL}/approval/documents/${req.params.id}`,
                    }));
                }
            } else {
                // 모든 결재 완료
                await conn.query(
                    `UPDATE approval_documents SET status='APPROVED', completed_at=NOW() WHERE id=?`,
                    [req.params.id]
                );
                // 기안자에게 완료 알림 + 이메일
                await conn.query(
                    `INSERT INTO approval_notifications (user_id, document_id, type, message)
                     VALUES (?, ?, 'APPROVED', ?)`,
                    [doc.drafter_id, req.params.id, `'${doc.title}' 문서가 최종 승인되었습니다.`]
                );
                const drafter = await getUserEmail(doc.drafter_id);
                if (drafter?.email) {
                    mailSilent(() => sendApprovalComplete({
                        to: drafter.email,
                        drafterName: drafter.name,
                        docTitle: doc.title,
                        docNumber: doc.doc_number,
                        docUrl: `${process.env.APP_URL}/approval/documents/${req.params.id}`,
                    }));
                }
            }
        }

        await conn.commit();

        const actionLabel = action === 'APPROVED' ? '승인' : '반려';
        logActivity('info', `결재 ${actionLabel}: "${doc.title}" (처리자: ${req.user.name})`, { userId: req.user.id, req });

        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: '처리 실패' });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────
// 알림
// ─────────────────────────────────────────

// GET /api/approval/notifications
router.get('/notifications', async (req, res) => {
    try {
        const [notifs] = await db.query(
            `SELECT n.*, d.title AS doc_title
             FROM approval_notifications n
             LEFT JOIN approval_documents d ON n.document_id = d.id
             WHERE n.user_id = ?
             ORDER BY n.created_at DESC LIMIT 30`,
            [req.user.id]
        );
        const [[{ unread }]] = await db.query(
            `SELECT COUNT(*) AS unread FROM approval_notifications WHERE user_id=? AND is_read=FALSE`,
            [req.user.id]
        );
        res.json({ success: true, data: { notifications: notifs, unread } });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PUT /api/approval/notifications/:id/read  ─ 개별 읽음
router.put('/notifications/:id/read', async (req, res) => {
    try {
        await db.query(
            `UPDATE approval_notifications SET is_read=TRUE WHERE id=? AND user_id=?`,
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// PUT /api/approval/notifications/read  ─ 전체 읽음
router.put('/notifications/read', async (req, res) => {
    try {
        await db.query(
            `UPDATE approval_notifications SET is_read=TRUE WHERE user_id=?`, [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// DELETE /api/approval/notifications/:id  ─ 알림 개별 삭제
router.delete('/notifications/:id', async (req, res) => {
    try {
        await db.query(
            `DELETE FROM approval_notifications WHERE id=? AND user_id=?`,
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// GET /api/approval/summary  ─ 대시보드용 요약
router.get('/summary', async (req, res) => {
    try {
        const [[inbox]] = await db.query(
            `SELECT COUNT(*) AS cnt FROM approval_lines al
             JOIN approval_documents ad ON al.document_id = ad.id
             WHERE al.approver_id=? AND al.status='PENDING'
             AND ad.status NOT IN ('CANCELLED')`, [req.user.id]
        );
        const [[myPending]] = await db.query(
            `SELECT COUNT(*) AS cnt FROM approval_documents
             WHERE drafter_id=? AND status IN ('PENDING','IN_PROGRESS')`, [req.user.id]
        );
        const [[myApproved]] = await db.query(
            `SELECT COUNT(*) AS cnt FROM approval_documents
             WHERE drafter_id=? AND status='APPROVED'
             AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [req.user.id]
        );
        const [[myDraft]] = await db.query(
            `SELECT COUNT(*) AS cnt FROM approval_documents
             WHERE drafter_id=? AND status='DRAFT'
             AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [req.user.id]
        );
        res.json({
            success: true,
            data: {
                inbox: inbox.cnt,
                my_pending: myPending.cnt,
                my_approved: myApproved.cnt,
                my_draft: myDraft.cnt
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// ============================================
// 첨부파일 업로드 POST /approval/documents/:id/attachments
// ============================================
router.post('/documents/:id/attachments', upload.array('files', 10), async (req, res) => {
    try {
        const docId = req.params.id;
        const [docs] = await db.query('SELECT id, drafter_id, status FROM approval_documents WHERE id = ?', [docId]);
        if (!docs.length) return res.status(404).json({ success: false, message: '문서 없음' });
        if (docs[0].drafter_id !== req.user.id) return res.status(403).json({ success: false, message: '권한 없음' });
        if (!['DRAFT','PENDING','IN_PROGRESS'].includes(docs[0].status)) {
            return res.status(400).json({ success: false, message: '완료/반려된 문서에는 첨부 불가' });
        }
        if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: '파일 없음' });

        // MIME 타입 검증
        for (const file of req.files) {
            const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const ext = path.extname(original).toLowerCase();
            const absPath = path.join(__dirname, '../uploads/approval', file.filename);
            const mimeError = await validateMimeType(absPath, ext);
            if (mimeError) {
                req.files.forEach(f => fs.unlink(path.join(__dirname, '../uploads/approval', f.filename), () => {}));
                return res.status(400).json({ success: false, message: mimeError });
            }
        }

        const inserted = [];
        for (const file of req.files) {
            const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const [result] = await db.query(
                `INSERT INTO approval_attachments (document_id, filename, filepath, filesize, mimetype, uploaded_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [docId, original, `approval/${file.filename}`, file.size, file.mimetype, req.user.id]
            );
            inserted.push({ id: result.insertId, filename: original, filepath: `approval/${file.filename}`, filesize: file.size });
        }
        res.json({ success: true, data: inserted });
    } catch (e) {
        console.error('결재 첨부 업로드 오류:', e);
        res.status(500).json({ success: false, message: '업로드 실패' });
    }
});

// 첨부파일 삭제 DELETE /approval/attachments/:attachId
router.delete('/attachments/:attachId', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT aa.*, ad.drafter_id FROM approval_attachments aa
             JOIN approval_documents ad ON aa.document_id = ad.id
             WHERE aa.id = ?`, [req.params.attachId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: '파일 없음' });
        if (rows[0].drafter_id !== req.user.id) return res.status(403).json({ success: false, message: '권한 없음' });

        const filePath = path.join(__dirname, '../uploads', rows[0].filepath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await db.query('DELETE FROM approval_attachments WHERE id = ?', [req.params.attachId]);
        res.json({ success: true, message: '삭제 완료' });
    } catch (e) {
        res.status(500).json({ success: false, message: '삭제 실패' });
    }
});

module.exports = router;