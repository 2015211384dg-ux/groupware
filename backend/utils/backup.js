'use strict';
const { spawn } = require('child_process');
const { createGzip } = require('zlib');
const { createWriteStream, promises: fsp } = require('fs');
const path = require('path');

async function runBackup() {
    const backupRoot = process.env.BACKUP_PATH;
    if (!backupRoot) return;

    const dateStr = new Date().toISOString().slice(0, 10);
    const backupDir = path.join(backupRoot, dateStr);
    await fsp.mkdir(backupDir, { recursive: true });

    await Promise.all([
        backupDatabase(backupDir, dateStr),
        backupUploads(backupDir, dateStr),
    ]);

    await pruneOldBackups(backupRoot);
}

function backupDatabase(dir, dateStr) {
    return new Promise((resolve, reject) => {
        const { DB_HOST = 'localhost', DB_PORT = '3306', DB_USER, DB_NAME, DB_PASSWORD } = process.env;
        const outFile = path.join(dir, `db_${dateStr}.sql.gz`);

        const dump = spawn('mysqldump', [
            `--host=${DB_HOST}`,
            `--port=${DB_PORT}`,
            `--user=${DB_USER}`,
            '--single-transaction',
            '--routines',
            '--triggers',
            DB_NAME,
        ], {
            env: { ...process.env, MYSQL_PWD: DB_PASSWORD },
        });

        const gzip = createGzip();
        const output = createWriteStream(outFile);
        dump.stdout.pipe(gzip).pipe(output);

        let stderrBuf = '';
        dump.stderr.on('data', d => { stderrBuf += d; });

        output.on('finish', () => {
            // mysqldump는 정상 실행 시에도 stderr에 경고를 남길 수 있음
            if (stderrBuf && !/using a password/i.test(stderrBuf)) {
                console.warn('[backup] mysqldump stderr:', stderrBuf.trim());
            }
            console.log(`[backup] DB 백업: ${outFile}`);
            resolve();
        });
        dump.on('error', reject);
        output.on('error', reject);
    });
}

function backupUploads(dir, dateStr) {
    return new Promise((resolve, reject) => {
        const uploadsAbs = path.resolve(process.env.UPLOAD_PATH || './uploads');
        const outFile = path.join(dir, `uploads_${dateStr}.tar.gz`);

        const tar = spawn('tar', [
            '-czf', outFile,
            '-C', path.dirname(uploadsAbs),
            path.basename(uploadsAbs),
        ]);

        let stderrBuf = '';
        tar.stderr.on('data', d => { stderrBuf += d; });
        tar.on('close', code => {
            if (code !== 0) return reject(new Error(`tar 실패 (exit ${code}): ${stderrBuf.trim()}`));
            console.log(`[backup] 파일 백업: ${outFile}`);
            resolve();
        });
        tar.on('error', reject);
    });
}

async function pruneOldBackups(backupRoot) {
    const keepDays = parseInt(process.env.BACKUP_KEEP_DAYS || '30', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);

    let entries;
    try {
        entries = await fsp.readdir(backupRoot, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
        if (new Date(entry.name) < cutoff) {
            await fsp.rm(path.join(backupRoot, entry.name), { recursive: true, force: true });
            console.log(`[backup] 오래된 백업 삭제: ${entry.name}`);
        }
    }
}

// 매일 새벽 2시에 실행. BACKUP_PATH 미설정 시 자동 비활성화 (마이그레이션 후 .env에서 활성화)
function scheduleDailyBackup() {
    if (!process.env.BACKUP_PATH) {
        // BACKUP_PATH 설정 시 자동 활성화됨 — 별도 코드 변경 불필요
        return;
    }

    const now = new Date();
    const next2am = new Date();
    next2am.setHours(2, 0, 0, 0);
    if (next2am <= now) next2am.setDate(next2am.getDate() + 1);
    const delay = next2am - now;

    setTimeout(async function tick() {
        try {
            console.log('[backup] 일일 자동 백업 시작');
            await runBackup();
            console.log('[backup] 일일 자동 백업 완료');
        } catch (err) {
            console.error('[backup] 자동 백업 실패:', err.message);
        }
        setTimeout(tick, 24 * 60 * 60 * 1000);
    }, delay);

    const h = Math.floor(delay / 3600000);
    const m = Math.floor((delay % 3600000) / 60000);
    console.log(`[backup] 다음 백업 예약: ${h}시간 ${m}분 후 (새벽 2시)`);
}

module.exports = { scheduleDailyBackup, runBackup };
