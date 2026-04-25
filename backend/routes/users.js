const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { authMiddleware, checkRole } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { logActivity, validatePassword, checkPasswordHistory, savePasswordHistory } = require('../utils/logger');
const db = require('../config/database');

const profileUploadDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(profileUploadDir)) fs.mkdirSync(profileUploadDir, { recursive: true });

const profileUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, profileUploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `profile_${req.user.id}_${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
});

const VALID_ROLES = ['USER', 'HR_ADMIN', 'SUPER_ADMIN'];
const VALID_THEMES = ['light', 'dark'];
const VALID_LANGS = ['ko', 'en'];

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// ============================================
// 사용자 목록 조회
// ============================================
router.get('/', checkRole('SUPER_ADMIN', 'HR_ADMIN'), cacheMiddleware(120), async (req, res) => {
    try {
        const { search, role, status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT u.id, u.username, u.name, u.email, u.role, u.is_active, u.last_login,
                   u.login_fail_count, u.locked_until,
                   e.employee_number, e.department_id, e.position, e.job_title,
                   e.mobile, e.status as employee_status,
                   d.name as department_name
            FROM users u
            LEFT JOIN employees e ON u.id = e.user_id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE 1=1
        `;
        
        const params = [];

        if (search) {
            query += ` AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (role) {
            query += ` AND u.role = ?`;
            params.push(role);
        }

        if (status) {
            query += ` AND e.status = ?`;
            params.push(status);
        }

        // 총 개수 조회
        const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
        const [countResult] = await db.query(countQuery, params);
        const total = countResult[0].total;

        // 데이터 조회
        query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [users] = await db.query(query, params);

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: '사용자 목록 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 내 설정 조회
// ============================================
router.get('/my-settings', async (req, res) => {
    try {
        const [settings] = await db.query(
            'SELECT id, user_id, email_notifications, desktop_notifications, post_notifications, comment_notifications, theme, language, show_birthday, show_profile, updated_at FROM user_settings WHERE user_id = ?',
            [req.user.id]
        );

        // 설정이 없으면 기본값 반환
        if (settings.length === 0) {
            return res.json({
                success: true,
                data: {
                    email_notifications: true,
                    desktop_notifications: true,
                    post_notifications: true,
                    comment_notifications: true,
                    theme: 'light',
                    language: 'ko',
                    show_birthday: true,
                    show_profile: true
                }
            });
        }

        res.json({
            success: true,
            data: settings[0]
        });
    } catch (error) {
        console.error('Get user settings error:', error);
        res.status(500).json({
            success: false,
            message: '설정 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 사용자 상세 조회
// ============================================
router.get('/:id', cacheMiddleware(120), async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT u.id, u.username, u.name, u.email, u.role, u.is_active, 
                    u.created_at, u.last_login,
                    e.employee_number, e.department_id, e.position, e.job_title,
                    e.extension, e.mobile, e.birth_date, e.hire_date,
                    e.status, e.seat_location, e.profile_image,
                    d.name as department_name
             FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE u.id = ?`,
            [req.params.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: users[0]
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: '사용자 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 사용자 생성
// ============================================
router.post('/', checkRole('SUPER_ADMIN', 'HR_ADMIN'), invalidateCache(/^api:.*\/api\/v1\/users/), invalidateCache(/^api:.*\/api\/v1\/departments/), invalidateCache(/^api:.*\/api\/v1\/addressbook/), [
    body('username').trim().notEmpty().withMessage('아이디를 입력해주세요.')
        .isLength({ min: 3, max: 50 }).withMessage('아이디는 3~50자여야 합니다.')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('아이디는 영문, 숫자, 밑줄만 사용 가능합니다.'),
    body('email').isEmail().withMessage('올바른 이메일 형식이 아닙니다.').normalizeEmail(),
    body('name').trim().notEmpty().withMessage('이름을 입력해주세요.').isLength({ max: 50 }),
    body('password').isLength({ min: 6, max: 100 }).withMessage('비밀번호는 6자 이상 100자 이하여야 합니다.'),
    body('role').optional().isIn(VALID_ROLES).withMessage('유효하지 않은 권한입니다.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
        const {
            username,
            email,
            name,
            password,
            employee_number,
            department_id,
            position,
            phone,
            mobile
        } = req.body;

        // HR_ADMIN은 일반 사용자만 생성 가능
        const role = req.user.role === 'HR_ADMIN' ? 'USER' : (req.body.role || 'USER');

        // 중복 확인
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: '이미 존재하는 아이디 또는 이메일입니다.'
            });
        }

        // 비밀번호 정책 검사
        const pwCheck = await validatePassword(password, db);
        if (!pwCheck.valid) {
            return res.status(400).json({ success: false, message: pwCheck.message });
        }

        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);

        // 트랜잭션 시작
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 사용자 생성 (임시 비밀번호 → 첫 로그인 시 변경 강제)
            const [userResult] = await connection.query(
                `INSERT INTO users (username, email, name, password, role, require_password_change)
                 VALUES (?, ?, ?, ?, ?, 1)`,
                [username, email, name, hashedPassword, role]
            );

            const userId = userResult.insertId;

            // 직원 정보 생성
            if (employee_number || department_id || position) {
                await connection.query(
                    `INSERT INTO employees (user_id, employee_number, department_id, position, phone, mobile, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
                    [userId, employee_number || null, department_id || null, position || null, phone || null, mobile || null]
                );
            }

            await connection.commit();

            // 초기 비밀번호 이력 시드
            await savePasswordHistory(userId, hashedPassword);

            logActivity('success', `사용자 생성: ${username} (관리자: ${req.user.name})`, { userId: req.user.id, req });

            res.status(201).json({
                success: true,
                message: '사용자가 생성되었습니다.',
                data: { id: userId }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: '사용자 생성 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 내 정보 수정
// ============================================
router.put('/me', [
    body('email').optional().isEmail().withMessage('올바른 이메일 형식이 아닙니다.').normalizeEmail(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const connection = await db.getConnection();
    try {
        const { email, phone, mobile, signature_data } = req.body;

        // 이메일 중복 확인 (자신 제외)
        if (email) {
            const [existing] = await connection.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, req.user.id]
            );
            if (existing.length > 0) {
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: '이미 사용중인 이메일입니다.'
                });
            }
        }

        await connection.beginTransaction();

        // users 테이블 업데이트 (서명 포함)
        await connection.query(
            `UPDATE users SET email = ?, signature_data = COALESCE(?, signature_data) WHERE id = ?`,
            [email, signature_data || null, req.user.id]
        );

        // employees 테이블 업데이트
        await connection.query(
            `UPDATE employees SET phone = ?, mobile = ? WHERE user_id = ?`,
            [phone, mobile, req.user.id]
        );

        await connection.commit();

        res.json({
            success: true,
            message: '정보가 수정되었습니다.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Update user info error:', error);
        res.status(500).json({
            success: false,
            message: '정보 수정 중 오류가 발생했습니다.'
        });
    } finally {
        connection.release();
    }
});

// ============================================
// 프로필 사진 업로드
// ============================================
router.post('/me/profile-image', (req, res) => {
    profileUpload.single('image')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.file) return res.status(400).json({ success: false, message: '파일이 없습니다.' });

        const filepath = `uploads/profiles/${req.file.filename}`;

        // 기존 프로필 사진 삭제
        const [rows] = await db.query('SELECT profile_image FROM employees WHERE user_id = ?', [req.user.id]);
        if (rows[0]?.profile_image) {
            const oldPath = path.join(__dirname, '..', rows[0].profile_image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await db.query('UPDATE employees SET profile_image = ? WHERE user_id = ?', [filepath, req.user.id]);
        res.json({ success: true, profile_image: filepath });
    });
});

// ============================================
// 서명만 별도 저장 (PUT /api/users/me/signature)
// ============================================
router.put('/me/signature', async (req, res) => {
    try {
        const { signature_data } = req.body;
        if (!signature_data) {
            return res.status(400).json({ success: false, message: '서명 데이터가 없습니다.' });
        }
        await db.query(
            'UPDATE users SET signature_data = ? WHERE id = ?',
            [signature_data, req.user.id]
        );
        res.json({ success: true, message: '서명이 저장되었습니다.' });
    } catch (error) {
        console.error('Signature save error:', error);
        res.status(500).json({ success: false, message: '서명 저장 실패' });
    }
});

// 서명 삭제
router.delete('/me/signature', async (req, res) => {
    try {
        await db.query('UPDATE users SET signature_data = NULL WHERE id = ?', [req.user.id]);
        res.json({ success: true, message: '서명이 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: '서명 삭제 실패' });
    }
});

// ============================================
// 내 설정 저장
// ============================================
router.put('/my-settings', [
    body('theme').optional().isIn(VALID_THEMES).withMessage('유효하지 않은 테마입니다.'),
    body('language').optional().isIn(VALID_LANGS).withMessage('유효하지 않은 언어입니다.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
        const {
            email_notifications,
            desktop_notifications,
            post_notifications,
            comment_notifications,
            theme,
            language,
            show_birthday,
            show_profile
        } = req.body;

        // 기존 설정 확인
        const [existing] = await db.query(
            'SELECT id FROM user_settings WHERE user_id = ?',
            [req.user.id]
        );

        if (existing.length > 0) {
            // 업데이트
            await db.query(`
                UPDATE user_settings SET
                    email_notifications = ?,
                    desktop_notifications = ?,
                    post_notifications = ?,
                    comment_notifications = ?,
                    theme = ?,
                    language = ?,
                    show_birthday = ?,
                    show_profile = ?,
                    updated_at = NOW()
                WHERE user_id = ?
            `, [
                email_notifications,
                desktop_notifications,
                post_notifications,
                comment_notifications,
                theme,
                language,
                show_birthday,
                show_profile,
                req.user.id
            ]);
        } else {
            // 새로 생성
            await db.query(`
                INSERT INTO user_settings (
                    user_id,
                    email_notifications,
                    desktop_notifications,
                    post_notifications,
                    comment_notifications,
                    theme,
                    language,
                    show_birthday,
                    show_profile
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                req.user.id,
                email_notifications,
                desktop_notifications,
                post_notifications,
                comment_notifications,
                theme,
                language,
                show_birthday,
                show_profile
            ]);
        }

        res.json({
            success: true,
            message: '설정이 저장되었습니다.'
        });
    } catch (error) {
        console.error('Save user settings error:', error);
        res.status(500).json({
            success: false,
            message: '설정 저장 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 비밀번호 변경
// ============================================
router.put('/change-password', [
    body('currentPassword').notEmpty().withMessage('현재 비밀번호를 입력해주세요.'),
    body('newPassword').isLength({ min: 6, max: 100 }).withMessage('새 비밀번호는 6자 이상 100자 이하여야 합니다.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
        const { currentPassword, newPassword } = req.body;

        // 현재 비밀번호 확인
        const [users] = await db.query(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);

        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                message: '현재 비밀번호가 일치하지 않습니다.'
            });
        }

        // 비밀번호 이력 검사
        const historyCheck = await checkPasswordHistory(req.user.id, newPassword);
        if (historyCheck.reused) {
            return res.status(400).json({ success: false, message: historyCheck.message });
        }

        // 새 비밀번호 해시화
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 비밀번호 업데이트
        await db.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );
        await savePasswordHistory(req.user.id, hashedPassword);

        logActivity('info', `비밀번호 변경: ${req.user.name}`, { userId: req.user.id, req });

        res.json({
            success: true,
            message: '비밀번호가 변경되었습니다.'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: '비밀번호 변경 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 사용자 수정 (관리자용)
// ============================================
router.put('/:id', checkRole('SUPER_ADMIN', 'HR_ADMIN'), invalidateCache(/^api:.*\/api\/v1\/users/), invalidateCache(/^api:.*\/api\/v1\/departments/), invalidateCache(/^api:.*\/api\/v1\/addressbook/), async (req, res) => {
    try {
        const userId = req.params.id;
        const {
            email,
            name,
            password,
            role,
            employee_number,
            department_id,
            position,
            phone,
            mobile
        } = req.body;

        // 사용자 존재 확인
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (existingUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 사용자 기본 정보 업데이트
            let updateQuery = 'UPDATE users SET email = ?, name = ?';
            let updateParams = [email, name];

            if (role) {
                updateQuery += ', role = ?';
                updateParams.push(role);
            }

            // 비밀번호가 제공된 경우만 업데이트
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                updateQuery += ', password = ?';
                updateParams.push(hashedPassword);
            }

            updateQuery += ' WHERE id = ?';
            updateParams.push(userId);

            await connection.query(updateQuery, updateParams);

            // 직원 정보 업데이트
            const [employeeExists] = await connection.query(
                'SELECT id FROM employees WHERE user_id = ?',
                [userId]
            );

            if (employeeExists.length > 0) {
                // 기존 직원 정보 업데이트
                await connection.query(
                    `UPDATE employees SET 
                        employee_number = ?,
                        department_id = ?,
                        position = ?,
                        phone = ?,
                        mobile = ?
                     WHERE user_id = ?`,
                    [employee_number || null, department_id || null, position || null, phone || null, mobile || null, userId]
                );
            } else if (employee_number || department_id || position) {
                // 새로운 직원 정보 생성
                await connection.query(
                    `INSERT INTO employees (user_id, employee_number, department_id, position, phone, mobile, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
                    [userId, employee_number || null, department_id || null, position || null, phone || null, mobile || null]
                );
            }

            await connection.commit();

            logActivity('info', `사용자 정보 수정: ID ${userId} (관리자: ${req.user.name})`, { userId: req.user.id, req });

            res.json({
                success: true,
                message: '사용자 정보가 수정되었습니다.'
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: '사용자 수정 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 계정 잠금 해제 (관리자)
// ============================================
router.post('/:id/unlock', checkRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, name FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }
        await db.query(
            'UPDATE users SET login_fail_count = 0, locked_until = NULL WHERE id = ?',
            [req.params.id]
        );
        logActivity('info', `계정 잠금 해제: ${users[0].name} (관리자: ${req.user.name})`, { userId: req.user.id, req });
        res.json({ success: true, message: '계정 잠금이 해제되었습니다.' });
    } catch (error) {
        console.error('Unlock user error:', error);
        res.status(500).json({ success: false, message: '잠금 해제 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 사용자 비활성화 (SUPER_ADMIN 전용)
// ============================================
router.patch('/:id/deactivate', checkRole('SUPER_ADMIN'), invalidateCache(/^api:.*\/api\/v1\/users/), async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);

        if (targetId === req.user.id) {
            return res.status(400).json({ success: false, message: '자신의 계정은 비활성화할 수 없습니다.' });
        }

        const [users] = await db.query('SELECT id, name, role, is_active FROM users WHERE id = ?', [targetId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }
        if (users[0].role === 'SUPER_ADMIN') {
            return res.status(400).json({ success: false, message: '시스템 관리자 계정은 비활성화할 수 없습니다.' });
        }
        if (!users[0].is_active) {
            return res.status(400).json({ success: false, message: '이미 비활성화된 계정입니다.' });
        }

        await db.query('UPDATE users SET is_active = FALSE WHERE id = ?', [targetId]);

        // 해당 유저의 refresh token 모두 삭제 (즉시 로그아웃)
        await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [targetId]);

        logActivity('warning', `계정 비활성화: ${users[0].name} (관리자: ${req.user.name})`, { userId: req.user.id, req });
        res.json({ success: true, message: `${users[0].name} 계정이 비활성화되었습니다.` });
    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({ success: false, message: '비활성화 처리 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
