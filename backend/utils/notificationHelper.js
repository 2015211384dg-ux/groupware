const db = require('../config/database');

/**
 * 사용자에게 알림 생성 (fire-and-forget)
 * @param {number|number[]} userIds - 알림을 받을 유저 ID (또는 배열)
 * @param {{ type: string, title: string, body?: string, url?: string }} opts
 */
async function createNotification(userIds, { type, title, body, url }) {
    try {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        for (const uid of ids) {
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
