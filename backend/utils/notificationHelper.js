const db = require('../config/database');

/**
 * 사용자에게 알림 생성 (fire-and-forget)
 * @param {number|number[]} userIds - 알림을 받을 유저 ID (또는 배열)
 * @param {{ type: string, title: string, body?: string, url?: string }} opts
 */
async function createNotification(userIds, { type, title, body, url }, settingKey = null) {
    try {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        for (const uid of ids) {
            // 사용자 알림 설정 확인 (설정이 없으면 기본 허용)
            if (settingKey) {
                const [rows] = await db.query(
                    `SELECT \`${settingKey}\` AS val FROM user_settings WHERE user_id = ?`,
                    [uid]
                );
                if (rows.length > 0 && rows[0].val === 0) continue;
            }
            await db.query(
                'INSERT INTO notifications (user_id, type, title, body, url) VALUES (?, ?, ?, ?, ?)',
                [uid, type, title, body || null, url || null]
            );
        }
    } catch (err) {
        console.error('알림 생성 실패:', err.message);
    }
}

module.exports = { createNotification };
