const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/logger');

const clientLogLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: false,
    legacyHeaders: false,
});

// 토큰이 있으면 userId만 추출 — DB 조회 없이 가볍게, 실패 시 null
function extractUserId(req) {
    try {
        const token = req.cookies?.accessToken;
        if (!token) return null;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.userId || null;
    } catch { return null; }
}

// POST /api/v1/logs/client-error
router.post('/client-error', clientLogLimiter, (req, res) => {
    try {
        const { message, stack, page, action, errorType } = req.body || {};
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ success: false });
        }

        const userId = extractUserId(req);

        const parts = [
            `[${errorType || 'CLIENT'}]`,
            message.slice(0, 300),
            page   ? `페이지: ${page}`                    : null,
            action ? `동작: ${String(action).slice(0, 100)}` : null,
        ].filter(Boolean).join(' | ');

        const stackInfo = stack ? `\n스택: ${String(stack).slice(0, 500)}` : '';

        logActivity('error', parts + stackInfo, { userId, req });
        res.json({ success: true });
    } catch {
        res.json({ success: false });
    }
});

module.exports = router;
