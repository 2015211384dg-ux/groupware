const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

// 환경 변수 로드
dotenv.config();

const app = express();

// ============================================
// 미들웨어 설정
// ============================================

// 보안 헤더 (인트라넷 HTTP 환경 - HTTPS 강제 헤더 전체 비활성화)
app.use(helmet({
    hsts: false,
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
}));

// Rate Limiting - 전체 API
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
});

// Rate Limiting - 로그인 (IP당 제한, 브루트포스 방지)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 50, // IP당 15분에 50회 (NAT 환경 고려)
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' }
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth/login', loginLimiter);

// CORS 설정
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS 정책에 의해 차단된 origin: ${origin}`));
        }
    },
    credentials: true
}));

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser
app.use(cookieParser());

// 정적 파일 제공 (업로드된 파일)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 요청 로깅
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ============================================
// DB 마이그레이션 (refresh_tokens 테이블)
// ============================================
const db = require('./config/database');

db.query(`
    CREATE TABLE IF NOT EXISTS \`refresh_tokens\` (
        \`id\`          INT(11) NOT NULL AUTO_INCREMENT,
        \`user_id\`     INT(11) NOT NULL,
        \`token_hash\`  VARCHAR(255) NOT NULL,
        \`expires_at\`  DATETIME NOT NULL,
        \`created_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_user\` (\`user_id\`),
        KEY \`idx_token\` (\`token_hash\`),
        CONSTRAINT \`fk_rt_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('refresh_tokens 테이블 생성 실패:', err.message));

// system_settings 신규 컬럼 추가
const settingsCols = [
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_min_length INT NOT NULL DEFAULT 8 COMMENT '비밀번호 최소 길이'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_require_special TINYINT(1) NOT NULL DEFAULT 0 COMMENT '특수문자 필수'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS login_fail_lock_count INT NOT NULL DEFAULT 5 COMMENT '로그인 실패 잠금 횟수 (0=비활성)'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS log_retention_days INT NOT NULL DEFAULT 90 COMMENT '로그 보관 기간(일) (0=영구보관)'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS popup_notice_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '팝업 공지 활성화'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS popup_notice_title VARCHAR(200) DEFAULT NULL COMMENT '팝업 공지 제목'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS popup_notice_content TEXT DEFAULT NULL COMMENT '팝업 공지 내용'`,
];
settingsCols.forEach(sql => db.query(sql).catch(() => {}));

// users 로그인 잠금 컬럼 추가
db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_fail_count INT NOT NULL DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until DATETIME DEFAULT NULL`).catch(() => {});
db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});

// 점검 메시지 컬럼 추가
db.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS maintenance_message VARCHAR(500) DEFAULT NULL`).catch(() => {});

// 피드백 테이블 생성
db.query(`
    CREATE TABLE IF NOT EXISTS feedback (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        type        ENUM('bug','improvement','inconvenience','other') NOT NULL DEFAULT 'other',
        title       VARCHAR(200) NOT NULL,
        content     TEXT NOT NULL,
        status      ENUM('pending','reviewing','resolved','hold') NOT NULL DEFAULT 'pending',
        admin_note  TEXT DEFAULT NULL,
        created_at  DATETIME DEFAULT NOW(),
        updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW(),
        CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('feedback 테이블 생성 실패:', err.message));

// notifications 테이블 생성
db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        type        ENUM('post','comment','feedback','ar') NOT NULL,
        title       VARCHAR(255) NOT NULL,
        body        TEXT DEFAULT NULL,
        url         VARCHAR(500) DEFAULT NULL,
        message     TEXT DEFAULT NULL,
        link        VARCHAR(500) DEFAULT NULL,
        is_read     TINYINT(1) NOT NULL DEFAULT 0,
        created_at  DATETIME DEFAULT NOW(),
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('notifications 테이블 생성 실패:', err.message));

// ─── AR 프로젝트 테이블 ────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS ar_projects (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        ar_code         VARCHAR(50)  NOT NULL,
        title           VARCHAR(255) NOT NULL,
        description     TEXT,
        budget_amount   DECIMAL(18,2) NOT NULL DEFAULT 0,
        currency        VARCHAR(10)  NOT NULL DEFAULT 'KRW',
        status          ENUM('active','closed','on_hold') NOT NULL DEFAULT 'active',
        created_by      INT NOT NULL,
        created_at      DATETIME DEFAULT NOW(),
        updated_at      DATETIME DEFAULT NOW() ON UPDATE NOW(),
        CONSTRAINT fk_ar_creator FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('ar_projects 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS ar_activity_logs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        user_id     INT NOT NULL,
        action      VARCHAR(50) NOT NULL,
        detail      TEXT,
        created_at  DATETIME DEFAULT NOW(),
        CONSTRAINT fk_ar_log_proj FOREIGN KEY (project_id) REFERENCES ar_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_ar_log_user FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('ar_activity_logs 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS ar_project_teams (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        project_id    INT NOT NULL,
        department_id INT NOT NULL,
        UNIQUE KEY uq_ar_pt (project_id, department_id),
        CONSTRAINT fk_ar_pt_proj FOREIGN KEY (project_id) REFERENCES ar_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_ar_pt_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('ar_project_teams 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS ar_expenses (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        user_id     INT NOT NULL,
        amount      DECIMAL(18,2) NOT NULL,
        description TEXT NOT NULL,
        category    VARCHAR(100),
        spent_at    DATE NOT NULL,
        created_at  DATETIME DEFAULT NOW(),
        CONSTRAINT fk_ar_exp_project FOREIGN KEY (project_id) REFERENCES ar_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_ar_exp_user    FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('ar_expenses 테이블 생성 실패:', err.message));

// ar_projects ar_code 유니크 제약
db.query(`ALTER TABLE ar_projects ADD UNIQUE KEY uq_ar_code (ar_code)`).catch(() => {});

// notifications type ENUM에 'ar' 추가
db.query(`ALTER TABLE notifications MODIFY COLUMN type ENUM('post','comment','feedback','ar') NOT NULL`).catch(() => {});

// popup_notices 테이블 생성 (다중 팝업 공지)
db.query(`
    CREATE TABLE IF NOT EXISTS popup_notices (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        content     TEXT,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  DATETIME DEFAULT NOW(),
        updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('popup_notices 테이블 생성 실패:', err.message));

// ============================================
// 점검 모드 미들웨어
// ============================================

let _maintCache = { mode: false, msg: '', ts: 0 };

// 캐시 강제 갱신 (settings 저장 시 호출)
function invalidateMaintenanceCache() { _maintCache.ts = 0; }
module.exports = { invalidateMaintenanceCache };

const MAINTENANCE_BYPASS = [
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/me',
    '/api/v1/settings/public',
    '/api/v1/settings/maintenance',
    '/api/v1/admin/settings',
];

app.use('/api/', async (req, res, next) => {
    if (MAINTENANCE_BYPASS.some(p => req.path.startsWith(p.replace('/api/v1', '')))) return next();
    const now = Date.now();
    if (now - _maintCache.ts > 15000) {
        try {
            const [rows] = await db.query('SELECT maintenance_mode, maintenance_message FROM system_settings LIMIT 1');
            _maintCache = {
                mode: !!rows[0]?.maintenance_mode,
                msg:  rows[0]?.maintenance_message || '',
                ts:   now,
            };
        } catch { _maintCache.ts = now; }
    }
    if (_maintCache.mode) {
        return res.status(503).json({
            success: false,
            maintenance: true,
            message: _maintCache.msg || '시스템 점검 중입니다. 잠시 후 다시 접속해주세요.',
        });
    }
    next();
});

// ============================================
// 라우트 설정
// ============================================

// 헬스 체크
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const authRoutes        = require('./routes/auth');
const userRoutes        = require('./routes/users');
const departmentRoutes  = require('./routes/departments');
const boardRoutes       = require('./routes/boards');
const postRoutes        = require('./routes/posts');
const commentRoutes     = require('./routes/comments');
const addressbookRoutes = require('./routes/addressbook');
const hrRoutes          = require('./routes/hr');
const attachmentRoutes  = require('./routes/attachments');
const searchRoutes      = require('./routes/search');
const settingsRoutes    = require('./routes/settings');
const dashboardRoutes   = require('./routes/dashboard');
const eventRoutes       = require('./routes/events');
const approvalRoutes      = require('./routes/approval');
const approvalAdminRoutes = require('./routes/approvalAdmin');
const feedbackRoutes        = require('./routes/feedback');
const notificationRoutes    = require('./routes/notifications');
const arRoutes              = require('./routes/ar');

app.use('/api/v1/auth',            authRoutes);
app.use('/api/v1/users',           userRoutes);
app.use('/api/v1/departments',     departmentRoutes);
app.use('/api/v1/boards',          boardRoutes);
app.use('/api/v1/posts',           postRoutes);
app.use('/api/v1/comments',        commentRoutes);
app.use('/api/v1/addressbook',     addressbookRoutes);
app.use('/api/v1/hr',              hrRoutes);
app.use('/api/v1/attachments',     attachmentRoutes);
app.use('/api/v1/search',          searchRoutes);
app.use('/api/v1/settings',         settingsRoutes);
app.use('/api/v1/admin/settings',  settingsRoutes);
app.use('/api/v1/dashboard',       dashboardRoutes);
app.use('/api/v1/events',          eventRoutes);
app.use('/api/v1/approval/admin',  approvalAdminRoutes);
app.use('/api/v1/approval',        approvalRoutes);
app.use('/api/v1/feedback',        feedbackRoutes);
app.use('/api/v1/notifications',   notificationRoutes);
app.use('/api/v1/ar',              arRoutes);

// ============================================
// 에러 핸들링
// ============================================

// 프론트엔드 정적 파일 서빙 (SPA)
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || '서버 오류가 발생했습니다.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================
// 주기적 정리 작업
// ============================================

// 만료된 refresh_tokens 매 1시간마다 삭제
setInterval(async () => {
    try {
        const [result] = await db.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
        if (result.affectedRows > 0) {
            console.log(`[cleanup] 만료된 refresh_tokens ${result.affectedRows}개 삭제`);
        }
    } catch (err) {
        console.error('[cleanup] refresh_tokens 정리 실패:', err.message);
    }
}, 60 * 60 * 1000);

// 90일 이상된 system_logs 매일 새벽 3시 삭제
function scheduleDailyCleanup() {
    const now = new Date();
    const next3am = new Date();
    next3am.setHours(3, 0, 0, 0);
    if (next3am <= now) next3am.setDate(next3am.getDate() + 1);
    const msUntil3am = next3am - now;

    setTimeout(async function tick() {
        try {
            const [result] = await db.query(
                'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)'
            );
            if (result.affectedRows > 0) {
                console.log(`[cleanup] 90일 이상 system_logs ${result.affectedRows}개 삭제`);
            }
        } catch (err) {
            console.error('[cleanup] system_logs 정리 실패:', err.message);
        }
        setTimeout(tick, 24 * 60 * 60 * 1000);
    }, msUntil3am);
}
scheduleDailyCleanup();

// ============================================
// 서버 시작
// ============================================

const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log(`🚀 그룹웨어 서버가 시작되었습니다.`);
    console.log(`📡 포트: ${PORT}`);
    console.log(`🌍 호스트: ${HOST}`);
    console.log(`🔗 로컬: http://localhost:${PORT}`);
    console.log(`🔗 네트워크: http://10.18.10.70:${PORT}`);
    console.log('='.repeat(50));
});

module.exports = app;
