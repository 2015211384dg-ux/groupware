const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const { logActivity } = require('../utils/logger');

// ============================================
// 공개 엔드포인트 - 팝업 공지 (인증 불필요)
// ============================================
router.get('/public', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT site_name, password_min_length, password_require_special FROM system_settings ORDER BY id DESC LIMIT 1'
        );
        const data = rows[0] || { site_name: '그룹웨어', password_min_length: 8, password_require_special: false };
        data.password_require_special = Boolean(data.password_require_special);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: '설정 조회 실패' });
    }
});

// 점검 모드 상태 (인증 불필요 — 프론트엔드 앱 초기화 시 폴링)
router.get('/maintenance', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT maintenance_mode, maintenance_message FROM system_settings LIMIT 1');
        res.json({
            maintenance: !!rows[0]?.maintenance_mode,
            message: rows[0]?.maintenance_message || '',
        });
    } catch {
        res.json({ maintenance: false, message: '' });
    }
});

// 활성화된 팝업 공지 목록 (인증 불필요)
router.get('/notices/public', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, title, content FROM popup_notices WHERE is_active = 1 ORDER BY created_at DESC'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: '공지 조회 실패' });
    }
});

// 이하 관리자 전용
router.use(authMiddleware);
router.use(adminMiddleware);

// ============================================
// 시스템 설정 조회
// ============================================
router.get('/', async (req, res) => {
    try {
        const [settings] = await db.query(
            `SELECT id, site_name, site_description, max_upload_size, session_timeout,
                    allow_registration, require_email_verification, maintenance_mode, maintenance_message,
                    password_min_length, password_require_special, login_fail_lock_count,
                    log_retention_days,
                    popup_notice_enabled, popup_notice_title, popup_notice_content,
                    created_at, updated_at
             FROM system_settings ORDER BY id DESC LIMIT 1`
        );

        if (settings.length === 0) {
            return res.json({
                success: true,
                data: {
                    site_name: '그룹웨어',
                    site_description: '우리 회사 그룹웨어 시스템',
                    max_upload_size: 10,
                    session_timeout: 60,
                    allow_registration: false,
                    require_email_verification: true,
                    maintenance_mode: false,
                    maintenance_message: '',
                    password_min_length: 8,
                    password_require_special: false,
                    login_fail_lock_count: 5,
                    log_retention_days: 90,
                    popup_notice_enabled: false,
                    popup_notice_title: '',
                    popup_notice_content: '',
                }
            });
        }

        const data = settings[0];
        data.allow_registration        = Boolean(data.allow_registration);
        data.require_email_verification = Boolean(data.require_email_verification);
        data.maintenance_mode          = Boolean(data.maintenance_mode);
        data.password_require_special  = Boolean(data.password_require_special);
        data.popup_notice_enabled      = Boolean(data.popup_notice_enabled);

        res.json({ success: true, data });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, message: '설정 조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 시스템 설정 저장
// ============================================
router.post('/', async (req, res) => {
    try {
        const {
            site_name, site_description, max_upload_size, session_timeout,
            allow_registration, require_email_verification, maintenance_mode, maintenance_message,
            password_min_length, password_require_special, login_fail_lock_count,
            log_retention_days,
            popup_notice_enabled, popup_notice_title, popup_notice_content,
        } = req.body;

        const [existing] = await db.query('SELECT id FROM system_settings LIMIT 1');

        const values = [
            site_name, site_description, max_upload_size, session_timeout,
            allow_registration ? 1 : 0,
            require_email_verification ? 1 : 0,
            maintenance_mode ? 1 : 0,
            maintenance_message || null,
            password_min_length ?? 8,
            password_require_special ? 1 : 0,
            login_fail_lock_count ?? 5,
            log_retention_days ?? 90,
            popup_notice_enabled ? 1 : 0,
            popup_notice_title || null,
            popup_notice_content || null,
        ];

        if (existing.length > 0) {
            await db.query(
                `UPDATE system_settings SET
                    site_name=?, site_description=?, max_upload_size=?, session_timeout=?,
                    allow_registration=?, require_email_verification=?, maintenance_mode=?, maintenance_message=?,
                    password_min_length=?, password_require_special=?, login_fail_lock_count=?,
                    log_retention_days=?,
                    popup_notice_enabled=?, popup_notice_title=?, popup_notice_content=?,
                    updated_at=NOW()
                 WHERE id=?`,
                [...values, existing[0].id]
            );
        } else {
            await db.query(
                `INSERT INTO system_settings
                    (site_name, site_description, max_upload_size, session_timeout,
                     allow_registration, require_email_verification, maintenance_mode, maintenance_message,
                     password_min_length, password_require_special, login_fail_lock_count,
                     log_retention_days,
                     popup_notice_enabled, popup_notice_title, popup_notice_content)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                values
            );
        }

        // 점검 모드 캐시 즉시 갱신
        try { require('../server').invalidateMaintenanceCache?.(); } catch {}

        logActivity('info', `시스템 설정 변경 (관리자: ${req.user.name})`, { userId: req.user.id, req });

        res.json({ success: true, message: '설정이 저장되었습니다.' });
    } catch (error) {
        console.error('Save settings error:', error);
        res.status(500).json({ success: false, message: '설정 저장 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 시스템 로그 조회
// ============================================
router.get('/logs', async (req, res) => {
    try {
        const { limit = 100, type, search, user } = req.query;

        if (!user) {
            return res.json({ success: true, data: [] });
        }

        let query = `SELECT l.id, l.log_type, l.message, l.ip_address, l.created_at,
                            u.name as user_name, u.username
                     FROM system_logs l
                     LEFT JOIN users u ON l.user_id = u.id
                     WHERE (u.name LIKE ? OR u.username LIKE ?)`;
        const params = [`%${user}%`, `%${user}%`];

        if (type) { query += ' AND l.log_type = ?'; params.push(type); }
        if (search) { query += ' AND l.message LIKE ?'; params.push(`%${search}%`); }

        query += ' ORDER BY l.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [logs] = await db.query(query, params);
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ success: false, message: '로그 조회 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 로그 수동 삭제
// ============================================
router.delete('/logs', async (req, res) => {
    try {
        const { days } = req.query;
        const d = parseInt(days) || 90;
        const [result] = await db.query(
            'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [d]
        );
        logActivity('info', `시스템 로그 수동 삭제: ${result.affectedRows}건 (${d}일 이전, 관리자: ${req.user.name})`, { userId: req.user.id, req });
        res.json({ success: true, message: `${result.affectedRows}건의 로그가 삭제되었습니다.` });
    } catch (error) {
        console.error('Delete logs error:', error);
        res.status(500).json({ success: false, message: '로그 삭제 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 팝업 공지 관리 (관리자)
// ============================================

// 전체 목록
router.get('/notices', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, title, content, is_active, created_at, updated_at FROM popup_notices ORDER BY created_at DESC'
        );
        rows.forEach(r => { r.is_active = Boolean(r.is_active); });
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get notices error:', error.message);
        res.status(500).json({ success: false, message: '공지 목록 조회 실패' });
    }
});

// 공지 추가
router.post('/notices', async (req, res) => {
    try {
        const { title, content, is_active = true } = req.body;
        if (!title) return res.status(400).json({ success: false, message: '제목을 입력해주세요.' });
        const [result] = await db.query(
            'INSERT INTO popup_notices (title, content, is_active) VALUES (?, ?, ?)',
            [title, content || '', is_active ? 1 : 0]
        );
        logActivity('info', `팝업 공지 추가: "${title}" (관리자: ${req.user.name})`, { userId: req.user.id, req });
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: '공지 추가 실패' });
    }
});

// 공지 수정 (내용 변경 + 활성화/비활성화)
router.put('/notices/:id', async (req, res) => {
    try {
        const { title, content, is_active } = req.body;
        const updates = [];
        const params = [];
        if (title !== undefined)     { updates.push('title = ?');     params.push(title); }
        if (content !== undefined)   { updates.push('content = ?');   params.push(content); }
        if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
        if (updates.length === 0) return res.status(400).json({ success: false, message: '수정할 내용이 없습니다.' });
        params.push(req.params.id);
        await db.query(`UPDATE popup_notices SET ${updates.join(', ')}, updated_at=NOW() WHERE id = ?`, params);
        logActivity('info', `팝업 공지 수정: ID ${req.params.id} (관리자: ${req.user.name})`, { userId: req.user.id, req });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: '공지 수정 실패' });
    }
});

// 공지 삭제
router.delete('/notices/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM popup_notices WHERE id = ?', [req.params.id]);
        logActivity('warning', `팝업 공지 삭제: ID ${req.params.id} (관리자: ${req.user.name})`, { userId: req.user.id, req });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: '공지 삭제 실패' });
    }
});

module.exports = router;

// ============================================
// 로그 자동 정리 Job (서버 시작 시 등록)
// 매 24시간마다 log_retention_days 설정에 따라 오래된 로그 삭제
// ============================================
function startLogCleanupJob() {
    const run = async () => {
        try {
            const [rows] = await db.query(
                'SELECT log_retention_days FROM system_settings ORDER BY id DESC LIMIT 1'
            );
            const days = rows[0]?.log_retention_days ?? 90;
            if (days === 0) return; // 0 = 영구 보관

            const [result] = await db.query(
                'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
                [days]
            );
            if (result.affectedRows > 0) {
                console.log(`🗑️ 로그 자동 정리: ${result.affectedRows}건 삭제 (${days}일 이전)`);
            }
        } catch (err) {
            console.error('로그 자동 정리 실패:', err.message);
        }
    };

    setTimeout(run, 10000); // 시작 10초 후 1회 (마이그레이션 완료 대기)
    setInterval(run, 24 * 60 * 60 * 1000); // 매 24시간
}

startLogCleanupJob();
