'use strict';
const express = require('express');
const router = express.Router();
const { open: fsOpen, stat: fsStat, readdir } = require('fs/promises');
const path = require('path');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const superAdminOnly = [
    authenticateToken,
    (req, res, next) => {
        if (req.user?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: '슈퍼관리자 전용입니다.' });
        next();
    },
];

const LOG_DIR = process.env.PM2_LOG_DIR || path.resolve(__dirname, '../../logs');

const PM2_FILES = {
    'backend-out':   'backend-out.log',
    'backend-error': 'backend-error.log',
    'frontend-out':  'frontend-out.log',
    'frontend-error':'frontend-error.log',
    'rag-out':       'rag-out.log',
    'rag-error':     'rag-error.log',
};

// 파일 끝에서 최대 maxBytes 읽기
async function tailFile(filePath, maxBytes = 1024 * 1024) {
    try {
        const s = await fsStat(filePath);
        if (s.size === 0) return '';
        const readSize = Math.min(s.size, maxBytes);
        const buf = Buffer.alloc(readSize);
        const fh = await fsOpen(filePath, 'r');
        await fh.read(buf, 0, readSize, s.size - readSize);
        await fh.close();
        return buf.toString('utf8');
    } catch {
        return null; // 파일 없음
    }
}

// PM2 타임스탬프 파싱: "2026-04-30T02:15:23: message"
function parsePm2Line(raw) {
    const m = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?): (.*)$/);
    if (m) return { time: m[1], text: m[2] };
    return { time: null, text: raw };
}

// ── GET /admin/monitor/stats ─────────────────────────────
router.get('/stats', superAdminOnly, async (req, res) => {
    try {
        const [[todayRows], [weekRows]] = await Promise.all([
            db.query(`SELECT log_type, COUNT(*) cnt FROM system_logs WHERE created_at >= CURDATE() GROUP BY log_type`),
            db.query(`SELECT log_type, COUNT(*) cnt FROM system_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY log_type`),
        ]);
        const toMap = rows => rows.reduce((m, r) => ({ ...m, [r.log_type]: Number(r.cnt) }), {});
        res.json({ today: toMap(todayRows), week: toMap(weekRows) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /admin/monitor/logs ──────────────────────────────
router.get('/logs', superAdminOnly, async (req, res) => {
    try {
        const { type = 'error,warning', search, from, to, page = 1, limit = 100 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const conds = [], params = [];

        if (type && type !== 'all') {
            const types = type.split(',').filter(Boolean);
            conds.push(`l.log_type IN (${types.map(() => '?').join(',')})`);
            params.push(...types);
        }
        if (search) {
            conds.push('l.message LIKE ?');
            params.push(`%${search}%`);
        }
        if (from) { conds.push('l.created_at >= ?'); params.push(from); }
        if (to)   { conds.push('l.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }

        const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

        const [[logs], [[{ total }]]] = await Promise.all([
            db.query(
                `SELECT l.id, l.log_type, l.message, l.ip_address, l.created_at,
                        u.name AS user_name, u.username
                 FROM system_logs l
                 LEFT JOIN users u ON u.id = l.user_id
                 ${where}
                 ORDER BY l.created_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, Number(limit), offset]
            ),
            db.query(`SELECT COUNT(*) total FROM system_logs l ${where}`, params),
        ]);

        res.json({ logs, total: Number(total), page: Number(page), totalPages: Math.ceil(Number(total) / Number(limit)) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /admin/monitor/pm2 ───────────────────────────────
router.get('/pm2', superAdminOnly, async (req, res) => {
    try {
        const { files, lines = 500, search } = req.query;
        const keys = files ? files.split(',').filter(k => PM2_FILES[k]) : Object.keys(PM2_FILES);

        const results = [];
        for (const key of keys) {
            const content = await tailFile(path.join(LOG_DIR, PM2_FILES[key]));
            if (content === null) continue;

            const [processName, stream] = key.split('-');
            const rawLines = content.split('\n').filter(Boolean);

            for (const raw of rawLines) {
                if (search && !raw.toLowerCase().includes(search.toLowerCase())) continue;
                const { time, text } = parsePm2Line(raw);
                results.push({ time, text, raw, process: processName, stream, key });
            }
        }

        // 타임스탬프 기준 정렬, null은 뒤로
        results.sort((a, b) => {
            if (!a.time && !b.time) return 0;
            if (!a.time) return 1;
            if (!b.time) return -1;
            return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
        });

        const maxLines = Math.min(Number(lines), 2000);
        res.json({ lines: results.slice(-maxLines) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /admin/monitor/pm2/files ─────────────────────────
// 로그 파일 목록 + 존재 여부 + 크기
router.get('/pm2/files', superAdminOnly, async (req, res) => {
    const info = await Promise.all(
        Object.entries(PM2_FILES).map(async ([key, file]) => {
            try {
                const s = await fsStat(path.join(LOG_DIR, file));
                return { key, file, size: s.size, mtime: s.mtime };
            } catch {
                return { key, file, size: null, mtime: null };
            }
        })
    );
    res.json({ files: info });
});

module.exports = router;
