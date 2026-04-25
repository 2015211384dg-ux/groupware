/**
 * 시스템 로그 기록 헬퍼
 * 비동기로 실행되며 실패해도 메인 흐름에 영향 없음
 */
const db = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * @param {'info'|'warning'|'error'|'success'} type
 * @param {string} message
 * @param {object} options - { userId, req }
 */
function logActivity(type, message, { userId = null, req = null } = {}) {
    const ip = req
        ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null)
        : null;
    const userAgent = req ? (req.headers['user-agent'] || null) : null;

    db.query(
        'INSERT INTO system_logs (log_type, message, user_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
        [type, message, userId, ip, userAgent]
    ).catch(err => console.error('시스템 로그 기록 실패:', err.message));
}

module.exports = { logActivity };

/**
 * 비밀번호 정책 검증
 * @returns {{ valid: boolean, message: string }}
 */
async function validatePassword(password, db) {
    const [rows] = await db.query(
        'SELECT password_min_length, password_require_special FROM system_settings ORDER BY id DESC LIMIT 1'
    );
    const minLen = rows[0]?.password_min_length ?? 8;
    const requireSpecial = Boolean(rows[0]?.password_require_special);

    if (password.length < minLen) {
        return { valid: false, message: `비밀번호는 최소 ${minLen}자 이상이어야 합니다.` };
    }
    if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return { valid: false, message: '비밀번호에 특수문자가 포함되어야 합니다.' };
    }
    return { valid: true };
}

/**
 * 비밀번호 이력 검사 — 최근 3개 재사용 차단
 */
async function checkPasswordHistory(userId, newPassword, dbConn) {
    const conn = dbConn || db;
    const [rows] = await conn.query(
        'SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 3',
        [userId]
    );
    for (const row of rows) {
        if (await bcrypt.compare(newPassword, row.password_hash)) {
            return { reused: true, message: '최근 3개의 비밀번호는 재사용할 수 없습니다.' };
        }
    }
    return { reused: false };
}

/**
 * 비밀번호 이력 저장 — 최대 10개 보관
 */
async function savePasswordHistory(userId, hashedPassword, dbConn) {
    const conn = dbConn || db;
    await conn.query(
        'INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)',
        [userId, hashedPassword]
    );
    // 오래된 이력 정리 (10개 초과분 삭제)
    await conn.query(
        `DELETE FROM password_history WHERE user_id = ? AND id NOT IN (
            SELECT id FROM (
                SELECT id FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
            ) t
        )`,
        [userId, userId]
    );
}

module.exports = { logActivity, validatePassword, checkPasswordHistory, savePasswordHistory };
