const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { logActivity, validatePassword } = require('../utils/logger');
const { createNotification } = require('../utils/notificationHelper');
const { cache } = require('../middleware/cache');

// 쿠키 공통 옵션
const isProduction = process.env.NODE_ENV === 'production';

// 인트라넷 HTTP 환경 — Secure 플래그 비활성화 (HTTPS 미사용)
const ACCESS_COOKIE_OPTS = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,  // 15분
    path: '/'
};

const REFRESH_COOKIE_OPTS = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7일
    path: '/api/v1/auth/refresh'
};

// 액세스 토큰 발급
const signAccessToken = (user) =>
    jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

// 리프레시 토큰 발급 및 DB 저장
const issueRefreshToken = async (userId) => {
    const token = crypto.randomBytes(32).toString('hex');
    const hash  = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [userId, hash, expiresAt]
    );
    return token;
};

// ============================================
// 로그인
// ============================================
router.post('/login', [
    body('username').notEmpty().withMessage('아이디를 입력해주세요'),
    body('password').notEmpty().withMessage('비밀번호를 입력해주세요')
], async (req, res) => {
    try {
        console.log('🔐 로그인 시도:', req.body.username);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const { username, password } = req.body;

        const [users] = await db.query(
            `SELECT u.*, e.employee_number, e.department_id, e.position, e.job_title
             FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             WHERE u.username = ? AND u.is_active = TRUE`,
            [username]
        );

        if (users.length === 0) {
            logActivity('warning', `로그인 실패 - 존재하지 않는 계정: ${username}`, { req });
            return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }

        const user = users[0];

        // 계정 잠금 확인
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            logActivity('warning', `로그인 차단 - 계정 잠금: ${username}`, { userId: user.id, req });
            return res.status(423).json({ success: false, message: `계정이 잠겼습니다. ${remaining}분 후 다시 시도해주세요.` });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            // 실패 횟수 증가 및 잠금 처리 (SUPER_ADMIN은 잠금 제외)
            const [settingsRows] = await db.query('SELECT login_fail_lock_count FROM system_settings ORDER BY id DESC LIMIT 1');
            const lockCount = settingsRows[0]?.login_fail_lock_count ?? 5;
            const newFailCount = (user.login_fail_count || 0) + 1;

            if (lockCount > 0 && newFailCount >= lockCount && user.role !== 'SUPER_ADMIN') {
                await db.query(
                    'UPDATE users SET login_fail_count=?, locked_until=DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id=?',
                    [newFailCount, user.id]
                );
                cache.deletePattern(/^api:.*\/api\/v1\/users/);
                logActivity('warning', `계정 잠금: ${username} (${newFailCount}회 연속 실패)`, { userId: user.id, req });

                // 관리자에게 보안 알림
                db.query("SELECT id FROM users WHERE role IN ('SUPER_ADMIN','ADMIN') AND is_active = TRUE")
                    .then(([admins]) => {
                        if (admins.length > 0) {
                            createNotification(admins.map(a => a.id), {
                                type: 'security',
                                title: '계정 잠금 발생',
                                body: `${username} 계정이 비밀번호 ${newFailCount}회 오류로 30분간 잠겼습니다.`,
                                url: '/settings'
                            });
                        }
                    }).catch(() => {});

                return res.status(423).json({ success: false, message: '로그인 실패가 반복되어 계정이 30분간 잠겼습니다.' });
            } else {
                await db.query('UPDATE users SET login_fail_count=? WHERE id=?', [newFailCount, user.id]);
            }

            logActivity('warning', `로그인 실패 - 비밀번호 오류: ${username} (${newFailCount}회)`, { userId: user.id, req });
            return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }

        // 로그인 성공 시 실패 카운트 초기화
        await db.query('UPDATE users SET login_fail_count=0, locked_until=NULL WHERE id=?', [user.id]);

        // 토큰 발급
        const accessToken  = signAccessToken(user);
        const refreshToken = await issueRefreshToken(user.id);

        // httpOnly 쿠키 설정
        res.cookie('accessToken',  accessToken,  ACCESS_COOKIE_OPTS);
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

        // 마지막 로그인 시간 업데이트
        await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        logActivity('success', `로그인: ${user.username} (${user.name})`, { userId: user.id, req });

        delete user.password;

        res.json({ success: true, message: '로그인 성공', data: { user } });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: '로그인 처리 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 토큰 갱신
// ============================================
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ success: false, message: '리프레시 토큰이 없습니다.' });
        }

        const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const [tokens] = await db.query(
            'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
            [hash]
        );

        if (tokens.length === 0) {
            res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
            return res.status(401).json({ success: false, message: '유효하지 않은 리프레시 토큰입니다.' });
        }

        const [users] = await db.query(
            'SELECT id, username, role FROM users WHERE id = ? AND is_active = TRUE',
            [tokens[0].user_id]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        // 기존 리프레시 토큰 삭제 후 새로 발급 (토큰 회전)
        await db.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash]);
        const newAccessToken  = signAccessToken(users[0]);
        const newRefreshToken = await issueRefreshToken(users[0].id);

        res.cookie('accessToken',  newAccessToken,  ACCESS_COOKIE_OPTS);
        res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTS);

        res.json({ success: true });

    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ success: false, message: '토큰 갱신 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 데스크탑 앱 전용 로그인 (토큰을 body로 반환)
// ============================================
router.post('/desktop/login', [
    body('username').notEmpty().withMessage('아이디를 입력해주세요'),
    body('password').notEmpty().withMessage('비밀번호를 입력해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const { username, password } = req.body;

        const [users] = await db.query(
            `SELECT u.*, e.employee_number, e.department_id, e.position
             FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             WHERE u.username = ? AND u.is_active = TRUE`,
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }

        const user = users[0];

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            return res.status(423).json({ success: false, message: `계정이 잠겼습니다. ${remaining}분 후 다시 시도해주세요.` });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }

        await db.query('UPDATE users SET login_fail_count=0, locked_until=NULL, last_login=NOW() WHERE id=?', [user.id]);

        const accessToken  = signAccessToken(user);
        const refreshToken = await issueRefreshToken(user.id);

        delete user.password;

        logActivity('success', `데스크탑 로그인: ${user.username} (${user.name})`, { userId: user.id, req });

        res.json({ success: true, data: { user, accessToken, refreshToken } });
    } catch (error) {
        console.error('Desktop login error:', error);
        res.status(500).json({ success: false, message: '로그인 처리 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 데스크탑 앱 전용 토큰 갱신
// ============================================
router.post('/desktop/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ success: false, message: '토큰이 없습니다.' });

        const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const [tokens] = await db.query(
            'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
            [hash]
        );

        if (tokens.length === 0) {
            return res.status(401).json({ success: false, message: '토큰이 만료되었습니다. 다시 로그인하세요.' });
        }

        const [users] = await db.query(
            `SELECT u.*, e.department_id FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             WHERE u.id = ? AND u.is_active = TRUE`,
            [tokens[0].user_id]
        );

        if (users.length === 0) return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

        const newAccessToken = signAccessToken(users[0]);
        res.json({ success: true, data: { accessToken: newAccessToken } });
    } catch (error) {
        console.error('Desktop refresh error:', error);
        res.status(500).json({ success: false });
    }
});

// ============================================
// 데스크탑 → 브라우저 자동 로그인 (매직 링크 — 일회성)
// ============================================
router.post('/desktop/magic-link', authMiddleware, async (req, res) => {
    try {
        const token = crypto.randomBytes(32).toString('hex');
        const hash  = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 1000); // 60초

        await db.query(
            'INSERT INTO magic_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
            [hash, req.user.id, expiresAt]
        );

        res.json({ success: true, data: { token } });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/magic-verify', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, message: '토큰이 없습니다.' });

        const hash = crypto.createHash('sha256').update(token).digest('hex');

        // 미사용 + 미만료 토큰 조회
        const [rows] = await db.query(
            'SELECT * FROM magic_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()',
            [hash]
        );
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: '링크가 만료되었거나 이미 사용된 링크입니다.' });
        }

        // 일회성 소진 처리
        await db.query('UPDATE magic_tokens SET used_at = NOW() WHERE token_hash = ?', [hash]);

        const [users] = await db.query(
            `SELECT u.*, e.department_id FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             WHERE u.id = ? AND u.is_active = TRUE`,
            [rows[0].user_id]
        );
        if (users.length === 0) return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

        const user = users[0];
        const accessToken  = signAccessToken(user);
        const refreshToken = await issueRefreshToken(user.id);

        res.cookie('accessToken',  accessToken,  ACCESS_COOKIE_OPTS);
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
        res.json({ success: true });
    } catch (err) {
        res.status(401).json({ success: false, message: '링크가 만료되었습니다. 다시 시도하세요.' });
    }
});

// ============================================
// 로그아웃
// ============================================
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            await db.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash]);
        }

        res.clearCookie('accessToken',  { path: '/', httpOnly: true });
        res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh', httpOnly: true });

        logActivity('info', `로그아웃: ${req.user.username} (${req.user.name})`, { userId: req.user.id, req });

        res.json({ success: true, message: '로그아웃 되었습니다.' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: '로그아웃 처리 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 현재 사용자 정보 조회
// ============================================
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies?.accessToken ||
            (req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.substring(7)
                : null);

        if (!token) {
            return res.json({ success: false, authenticated: false, user: null });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [users] = await db.query(
            `SELECT u.id, u.username, u.name, u.email, u.role, u.last_login, u.created_at,
                    u.signature_data, u.require_password_change,
                    e.employee_number, e.department_id, e.position, e.job_title,
                    e.phone, e.mobile, e.extension, e.profile_image,
                    d.name as department_name
             FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE u.id = ? AND u.is_active = TRUE`,
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.json({ success: false, authenticated: false, user: null });
        }

        res.json({ success: true, authenticated: true, user: users[0] });

    } catch (error) {
        // 토큰 만료/무효 → 401 없이 미인증 상태 반환
        res.json({ success: false, authenticated: false, user: null });
    }
});

// ============================================
// 비밀번호 변경
// ============================================
router.put('/change-password', [
    authMiddleware,
    body('currentPassword').notEmpty().withMessage('현재 비밀번호를 입력해주세요'),
    body('newPassword').notEmpty().withMessage('새 비밀번호를 입력해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const { currentPassword, newPassword } = req.body;

        // 시스템 비밀번호 정책 검증 (system_settings 기준)
        const policyCheck = await validatePassword(newPassword, db);
        if (!policyCheck.valid) {
            return res.status(400).json({ success: false, message: policyCheck.message });
        }

        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password);

        if (!isCurrentPasswordValid) {
            return res.status(400).json({ success: false, message: '현재 비밀번호가 일치하지 않습니다.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query(
            'UPDATE users SET password = ?, require_password_change = 0 WHERE id = ?',
            [hashedPassword, req.user.id]
        );

        res.json({ success: true, message: '비밀번호가 변경되었습니다.' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: '비밀번호 변경 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
