const db = require('../config/database');

// 민감 데이터 접근 감사 로그 (비동기 fire-and-forget)
function logAudit(userId, action, tableName, recordId, description, req) {
    const ip = req
        ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null)
        : null;
    const ua = req ? (req.headers['user-agent'] || null) : null;

    db.query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, action, tableName, recordId, description, ip, ua]
    ).catch(err => console.error('감사 로그 기록 실패:', err.message));
}

module.exports = { logAudit };
